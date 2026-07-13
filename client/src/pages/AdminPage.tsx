import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ArrowLeft, Shield, Users, AlertTriangle, Activity, Loader2, UserMinus, UserCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  evidence: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; username: string };
  reported: { id: string; name: string; username: string; isSuspended?: boolean };
}

interface Stats {
  usersCount: number;
  activeFriends: number;
  groupsCount: number;
  reportsCount: number;
  onlineUsersCount: number;
  uptime: number;
}

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadAdminData = async () => {
    setError('');
    try {
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);

      const reportsRes = await api.get('/admin/reports');
      setReports(reportsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch administrator data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAdminData();
  };

  const handleToggleSuspend = async (userId: string, currentSuspended: boolean) => {
    setActionLoadingId(userId);
    try {
      await api.put(`/admin/users/${userId}/suspend`, { suspend: !currentSuspended });
      // Reload stats and reports to sync suspension visual states
      loadAdminData();
      alert(`User account ${!currentSuspended ? 'suspended' : 'restored'} successfully.`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-2">
        <Loader2 size={32} className="animate-spin text-violet-400" />
        <p className="text-xs uppercase tracking-wider font-bold">Verifying admin credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                <Shield size={20} className="text-violet-400" /> Administration Dashboard
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">Moderation & Server Diagnostics</p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-slate-200">{stats.usersCount}</span>
                <Users size={16} className="text-slate-500" />
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Active Rooms</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-slate-200">{stats.groupsCount}</span>
                <Users size={16} className="text-slate-500" />
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Online Sessions</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-emerald-400">{stats.onlineUsersCount}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Reports Filed</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-pink-400">{stats.reportsCount}</span>
                <AlertTriangle size={16} className="text-pink-500" />
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-900 rounded-2xl flex flex-col justify-between col-span-2 md:col-span-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Server Uptime</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-xs font-bold text-slate-300">
                  {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
                </span>
                <Activity size={14} className="text-slate-500" />
              </div>
            </div>
          </div>
        )}

        {/* Reports Panel */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-900 bg-slate-900/20">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-pink-500" /> Pending Abuse Reports & Evidence
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            {reports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">No reports filed in the system.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="p-4">Reporter</th>
                    <th className="p-4">Reported User</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Transcript Evidence</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs">
                  {reports.map((report) => {
                    const isReportedSuspended = report.reported.isSuspended || false;
                    const actionLoading = actionLoadingId === report.reportedId;

                    return (
                      <tr key={report.id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-slate-200">{report.reporter.name}</p>
                          <p className="text-[10px] text-slate-500">@{report.reporter.username}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <p className="font-semibold text-slate-200">{report.reported.name}</p>
                              <p className="text-[10px] text-slate-500">@{report.reported.username}</p>
                            </div>
                            {isReportedSuspended && (
                              <span className="text-[8px] font-bold px-1 py-0.5 bg-red-950/40 border border-red-800/40 text-red-400 rounded uppercase">
                                Suspended
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 max-w-xs truncate text-slate-300" title={report.reason}>
                          {report.reason}
                        </td>
                        <td className="p-4">
                          {report.evidence ? (
                            <div className="p-2 bg-slate-950 border border-slate-900 rounded-lg font-mono text-[10px] text-slate-400 max-w-xs max-h-20 overflow-y-auto whitespace-pre-wrap">
                              {report.evidence}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">No message transcript provided (E2EE Chat)</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleSuspend(report.reportedId, isReportedSuspended)}
                            disabled={actionLoading}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ml-auto border ${
                              isReportedSuspended
                                ? 'bg-emerald-950/20 hover:bg-emerald-900/20 border-emerald-800/40 text-emerald-400'
                                : 'bg-red-950/20 hover:bg-red-900/20 border-red-800/40 text-red-400'
                            }`}
                          >
                            {actionLoading ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : isReportedSuspended ? (
                              <>
                                <UserCheck size={12} /> Unsuspend
                              </>
                            ) : (
                              <>
                                <UserMinus size={12} /> Suspend
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
