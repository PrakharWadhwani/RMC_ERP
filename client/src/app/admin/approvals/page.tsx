"use client";

import { useEffect, useState } from "react";
import { Check, X, UserLock, Loader2, ShieldAlert } from "lucide-react"; // Changed UserClock to UserLock
import { useAuthStore } from "../../../store/useAuthStore";
import api from "../../../lib/api";

export default function UserApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salaries, setSalaries] = useState<Record<number, string>>({});
  const { isAdmin } = useAuthStore();

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/pending-users");
      setPendingUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch pending users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  // Security Guard: Prevent non-admins from viewing the content
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <ShieldAlert size={64} className="text-red-500 mx-auto" />
          <h1 className="text-2xl font-black text-white uppercase">Access Denied</h1>
        </div>
      </div>
    );
  }

  const handleAction = async (userId: number, action: 'approve' | 'reject', salaryStr?: string) => {
    try {
      let url = `/auth/manage-user/${userId}?action=${action}`;
      if (action === "approve" && salaryStr) {
        url += `&salary=${parseFloat(salaryStr)}`;
      }
      await api.post(url);
      fetchUsers();
    } catch (err) {
      alert("Action failed");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black text-white uppercase mb-8">Staff Requests</h1>
      {loading ? (
        <Loader2 className="animate-spin text-white/20 mx-auto" size={40} />
      ) : pendingUsers.length === 0 ? (
        <div className="text-center p-20 bg-white/5 rounded-2xl">
          <UserLock className="mx-auto text-white/20 mb-4" size={48} /> {/* Fixed icon */}
          <p className="text-white/40 font-bold uppercase text-xs">No pending requests</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingUsers.map((user: any) => (
            <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10 gap-4">
              <div>
                <p className="text-white font-black">{user.username}</p>
                <p className="text-white/40 text-xs">{user.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[10px] text-white/40 uppercase font-black">Base Salary (₹)</label>
                  <input
                    type="number"
                    value={salaries[user.id] || ""}
                    onChange={(e) => setSalaries({ ...salaries, [user.id]: e.target.value })}
                    placeholder="e.g. 25000"
                    className="bg-black/50 border border-white/10 text-white font-mono px-3 py-1.5 rounded-lg w-full sm:w-32 focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                <div className="flex gap-3 shrink-0 items-center mt-4 sm:mt-0">
                  <button onClick={() => handleAction(user.id, 'reject')} className="text-red-500 font-bold px-4 hover:opacity-80">REJECT</button>
                  <button 
                    onClick={() => handleAction(user.id, 'approve', salaries[user.id])} 
                    className="bg-green-500 hover:bg-green-400 text-black font-black px-6 py-2 rounded-lg text-sm transition-colors"
                  >
                    APPROVE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}