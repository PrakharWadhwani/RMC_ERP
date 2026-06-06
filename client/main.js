// ============================================================================
// Rainbow ERP — Electron Main Process
// Manages FastAPI backend + Next.js frontend lifecycles inside a single frame.
// ============================================================================

const { app, BrowserWindow, session } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const net = require("net");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;
const POLL_INTERVAL_MS = 800;    // how often we probe port 3000
const MAX_POLL_ATTEMPTS = 120;   // give Next.js up to ~96 seconds to boot

// Resolve absolute directory paths regardless of CWD
const CLIENT_DIR = __dirname;                          // client/
const BACKEND_DIR = path.resolve(__dirname, "..", "backend");

// Track child processes so we can tear them down reliably
let backendProcess = null;
let frontendProcess = null;

// ---------------------------------------------------------------------------
// Utility: probe a TCP port — resolves true when something is listening
// ---------------------------------------------------------------------------
function isPortReady(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

// ---------------------------------------------------------------------------
// Utility: wait for a port with retries
// ---------------------------------------------------------------------------
async function waitForPort(port, label) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const ready = await isPortReady(port);
    if (ready) {
      console.log(`[Electron] ${label} is live on port ${port}`);
      return true;
    }
    if (attempt % 10 === 0) {
      console.log(`[Electron] Still waiting for ${label} (attempt ${attempt}/${MAX_POLL_ATTEMPTS})…`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error(`[Electron] Timed out waiting for ${label} on port ${port}`);
  return false;
}

// ---------------------------------------------------------------------------
// Spawn Backend: python -m uvicorn main:app --host 127.0.0.1 --port 8000
// ---------------------------------------------------------------------------
function spawnBackend() {
  console.log("[Electron] Spawning FastAPI backend…");
  backendProcess = spawn(
    "python",
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    {
      cwd: BACKEND_DIR,
      stdio: "pipe",             // quiet — no console window
      windowsHide: true,         // hide console window on Windows
      shell: false,
    }
  );
  backendProcess.stdout.on("data", (d) => process.stdout.write(`[Backend] ${d}`));
  backendProcess.stderr.on("data", (d) => process.stderr.write(`[Backend] ${d}`));
  backendProcess.on("exit", (code) => {
    console.log(`[Electron] Backend exited with code ${code}`);
    backendProcess = null;
  });
}

// ---------------------------------------------------------------------------
// Spawn Frontend: npm run start (the Next.js production server)
// ---------------------------------------------------------------------------
function spawnFrontend() {
  console.log("[Electron] Spawning Next.js production server…");
  frontendProcess = spawn(
    "npm",
    ["run", "start"],
    {
      cwd: CLIENT_DIR,
      stdio: "pipe",
      windowsHide: true,
      shell: true,               // required on Windows for npm
    }
  );
  frontendProcess.stdout.on("data", (d) => process.stdout.write(`[Frontend] ${d}`));
  frontendProcess.stderr.on("data", (d) => process.stderr.write(`[Frontend] ${d}`));
  frontendProcess.on("exit", (code) => {
    console.log(`[Electron] Frontend exited with code ${code}`);
    frontendProcess = null;
  });
}

// ---------------------------------------------------------------------------
// Kill zombie processes — hard cleanup via taskkill on Windows
// ---------------------------------------------------------------------------
function nukeZombies() {
  console.log("[Electron] Cleaning up child processes…");

  // 1. Graceful: kill our own tracked child processes first
  try {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill("SIGTERM");
    }
  } catch (_) { /* swallow */ }

  try {
    if (frontendProcess && !frontendProcess.killed) {
      frontendProcess.kill("SIGTERM");
    }
  } catch (_) { /* swallow */ }

  // 2. Nuclear: taskkill anything bound to our ports (Windows-specific)
  if (process.platform === "win32") {
    const commands = [
      // Kill any python.exe that uvicorn may have spawned
      'taskkill /F /IM python.exe /T 2>nul',
      // Kill any lingering node processes from "npm run start"
      // We scope this to the window title we never set, so we use
      // port-based detection via netstat instead:
      `FOR /F "tokens=5" %P IN ('netstat -aon ^| findstr :${BACKEND_PORT} ^| findstr LISTENING') DO taskkill /F /PID %P 2>nul`,
      `FOR /F "tokens=5" %P IN ('netstat -aon ^| findstr :${FRONTEND_PORT} ^| findstr LISTENING') DO taskkill /F /PID %P 2>nul`,
    ];

    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: "ignore", windowsHide: true, shell: true });
      } catch (_) {
        // taskkill returns non-zero if nothing to kill — that's fine
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Create the Electron BrowserWindow
// ---------------------------------------------------------------------------
async function createWindow() {
  // Clear all session storage, cookies, and cache on startup
  session.defaultSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'shadercache', 'cachestorage']
  });

  // Spawn servers
  spawnBackend();
  spawnFrontend();

  // Wait for the Next.js frontend to become reachable
  const ready = await waitForPort(FRONTEND_PORT, "Next.js Frontend");
  if (!ready) {
    console.error("[Electron] Frontend never came up. Exiting.");
    nukeZombies();
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Rainbow ERP",
    icon: path.join(CLIENT_DIR, "public", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      // Disable web security to bypass CORS within the Electron frame
      webSecurity: false,
      // Allow Node.js integration if needed in renderer (off by default for safety)
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Remove the default menu bar entirely for a clean desktop-app look
  win.setMenu(null);

  // Load the Next.js frontend
  win.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);

  // Safety net: Catch navigation errors (e.g., failed absolute redirects)
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Page failed to load: ${errorDescription} (${errorCode}) at ${validatedURL}`);
    // Fallback: reload the root frontend URL instead of showing a crash screen
    win.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
  });

  // Safety net: Catch renderer crashes
  win.webContents.on("render-process-gone", (event, details) => {
    console.error(`[Electron] Render process gone: ${details.reason}`);
    win.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
  });

  // Intercept close event to perform cloud sync before terminating
  let isSyncingAndClosing = false;
  win.on("close", (e) => {
    if (isSyncingAndClosing) return;
    e.preventDefault();
    isSyncingAndClosing = true;
    console.log("[Electron] Initiating sync to cloud before closing...");
    const syncProcess = spawn("python", ["drive_sync.py", "--push"], {
      cwd: BACKEND_DIR,
      windowsHide: true,
      shell: false,
    });
    
    syncProcess.stdout.on("data", (d) => process.stdout.write(`[Sync] ${d}`));
    syncProcess.stderr.on("data", (d) => process.stderr.write(`[Sync] ${d}`));
    
    syncProcess.on("close", (code) => {
      console.log(`[Electron] Cloud sync completed on close with code ${code}. Destroying window.`);
      win.destroy();
    });
  });

  // When the window is closed, tear everything down
  win.on("closed", () => {
    nukeZombies();
  });
}

// ---------------------------------------------------------------------------
// Electron App Lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  nukeZombies();
  app.quit();
});

app.on("before-quit", () => {
  nukeZombies();
});

// macOS dock re-open (safety — primary target is Windows)
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
