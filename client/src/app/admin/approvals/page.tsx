"use client";

import { useEffect, useState } from "react";
import { Check, X, UserLock, Loader2, ShieldAlert } from "lucide-react"; // Changed UserClock to UserLock
import { useAuthStore } from "../../../store/useAuthStore";
import api from "../../../lib/api";

export default function UserApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { username } = useAuthStore();

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
    if (username === "leo") fetchUsers();
  }, [username]);

  // Security Guard: Prevent non-admins from viewing the content
  if (username !== "leo") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <ShieldAlert size={64} className="text-red-500 mx-auto" />
          <h1 className="text-2xl font-black text-white uppercase">Access Denied</h1>
        </div>
      </div>
    );
  }

  const handleAction = async (userId: number, action: 'approve' | 'reject') => {
    try {
      await api.post(`/auth/manage-user/${userId}?action=${action}`);
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
            <div key={user.id} className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <p className="text-white font-black">{user.username}</p>
                <p className="text-white/40 text-xs">{user.email}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleAction(user.id, 'reject')} className="text-red-500 font-bold px-4">REJECT</button>
                <button onClick={() => handleAction(user.id, 'approve')} className="bg-green-500 text-black font-bold px-6 py-2 rounded-lg">APPROVE</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}