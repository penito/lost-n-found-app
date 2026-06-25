import React, { useState, useEffect } from 'react';
import { User, Post, Report } from '../types';
import { 
  getUsers, 
  deleteUser, 
  getReports, 
  resolveReport, 
  deleteReport, 
  deletePost, 
  deleteComment, 
  assertIsAdmin,
  getAllCommentsCount
} from '../db';
import { 
  Users, 
  ShieldAlert, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  FileText, 
  MessageSquare,
  Sparkles,
  Lock,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminTabProps {
  activeUser: User | null;
  posts: Post[];
  onPostsUpdated: () => void;
  onViewPost: (post: Post) => void;
}

export default function AdminTab({ activeUser, posts, onPostsUpdated, onViewPost }: AdminTabProps) {
  // --- VERIFICATION STATES ---
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [hasAdminPermission, setHasAdminPermission] = useState<boolean>(false);

  // --- ADMIN DATA STATES ---
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [totalComments, setTotalComments] = useState<number>(0);

  // User Deletion Modal States
  const [userDeleteId, setUserDeleteId] = useState<string | null>(null);
  const [userDeleteName, setUserDeleteName] = useState<string>('');

  // Status message notice
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- EFFECTS FOR SECURE ROLE VERIFICATION ---
  useEffect(() => {
    verifyRole();
  }, [activeUser]);

  const verifyRole = async () => {
    setIsVerifying(true);
    setHasAdminPermission(false);
    
    if (!activeUser) {
      setIsVerifying(false); // No user logged in
      return;
    }

    try {
      // 1. Verify on local frontend claim
      if (!activeUser.isAdmin) {
        setIsVerifying(false);
        return;
      }

      // 2. Perform secondary real-time backend check to ensure is_admin cannot be spoofed in UI
      const isValid = await assertIsAdmin(activeUser.id);
      if (isValid) {
        setHasAdminPermission(true);
        // Load data immediately if verified
        const fetchCommentsCount = async () => {
          try {
            const count = await getAllCommentsCount();
            setTotalComments(count);
          } catch (e) {
            console.error(e);
          }
        };
        await Promise.all([
          loadUsersListLocally(activeUser.id), 
          loadReportsListLocally(activeUser.id),
          fetchCommentsCount()
        ]);
      }
    } catch (err) {
      console.error('Admin verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const loadUsersListLocally = async (adminId: string) => {
    setLoadingUsers(true);
    try {
      const list = await getUsers(adminId);
      setUsers(list || []);
    } catch (err) {
      console.error('Failed to load user records list:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadReportsListLocally = async (adminId: string) => {
    setLoadingReports(true);
    try {
      const list = await getReports(adminId);
      setReports(list || []);
    } catch (err) {
      console.error('Failed to load report queue:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleRefreshData = async () => {
    if (!activeUser) return;
    setAlert({ type: 'success', text: 'Supabase 데이터 정밀 실시간 동기화 중...' });
    await Promise.all([loadUsersListLocally(activeUser.id), loadReportsListLocally(activeUser.id)]);
    setTimeout(() => setAlert(null), 1200);
  };

  // --- ACTIONS ---

  const handleForceDeleteUser = (id: string, name: string) => {
    setUserDeleteId(id);
    setUserDeleteName(name);
  };

  const confirmDeleteUserAction = async () => {
    if (userDeleteId && activeUser) {
      try {
        const res = await deleteUser(userDeleteId, activeUser.id);
        if (res.success) {
          setUserDeleteId(null);
          setAlert({ type: 'success', text: `${userDeleteName} 학우 계정이 성공적으로 강제 탈퇴 처리되었습니다.` });
          await loadUsersListLocally(activeUser.id);
          onPostsUpdated();
          setTimeout(() => setAlert(null), 3000);
        } else {
          setAlert({ type: 'error', text: res.message || '사용자 삭제 처리가 실패했습니다.' });
        }
      } catch (err: any) {
        setAlert({ type: 'error', text: err.message || '사용자 삭제 과정 중 오류가 발생했습니다.' });
      }
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (activeUser) {
      try {
        const res = await resolveReport(reportId, activeUser.id);
        if (res.success) {
          setAlert({ type: 'success', text: '신고 항목이 처리 완료되었습니다.' });
          await loadReportsListLocally(activeUser.id);
          setTimeout(() => setAlert(null), 1500);
        } else {
          setAlert({ type: 'error', text: res.message });
        }
      } catch {
        setAlert({ type: 'error', text: '처리 과정 중 에러가 발생했습니다.' });
      }
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (activeUser) {
      try {
        const res = await deleteReport(reportId, activeUser.id);
        if (res.success) {
          setAlert({ type: 'success', text: '신고 이력이 목록에서 영구적으로 제외되었습니다.' });
          await loadReportsListLocally(activeUser.id);
          setTimeout(() => setAlert(null), 1500);
        } else {
          setAlert({ type: 'error', text: res.message });
        }
      } catch {
        setAlert({ type: 'error', text: '신고 제거 과정 중 에러가 발생했습니다.' });
      }
    }
  };

  const handleAdminDeleteReportedItem = async (report: Report) => {
    if (!activeUser) return;
    try {
      if (report.targetType === 'post') {
        const delRes = await deletePost(report.targetId);
        if (delRes) {
          setAlert({ type: 'success', text: '신고 대상 게시글을 영구 삭제했습니다.' });
        } else {
          setAlert({ type: 'error', text: '해당 게시글이 이미 삭제되었거나 처리 실패했습니다.' });
        }
      } else {
        const delRes = await deleteComment(report.targetId);
        if (delRes) {
          setAlert({ type: 'success', text: '신고 대상 댓글을 영구 제명했습니다.' });
        } else {
          setAlert({ type: 'error', text: '해당 댓글이 이미 삭제되었거나 처리 실패했습니다.' });
        }
      }
      
      // Auto-delete the report after removing the offending element
      await deleteReport(report.id, activeUser.id);
      await loadReportsListLocally(activeUser.id);
      onPostsUpdated();
      setTimeout(() => setAlert(null), 1550);
    } catch {
      setAlert({ type: 'error', text: '오류가 발생하여 작업을 중단했습니다.' });
    }
  };

  // --- RENDERING CONDITIONS ---

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-150 rounded-3xl space-y-4 shadow-3xs max-w-lg mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-650 animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-slate-800 text-sm font-bold">보안 권한 등급을 확인하고 있습니다...</p>
          <p className="text-slate-400 text-xs">최고 시스템 제어자 연동 자격을 갱신하는 중입니다.</p>
        </div>
      </div>
    );
  }

  if (!hasAdminPermission) {
    return (
      <div className="flex flex-col items-center justify-center p-8 py-20 bg-rose-50 border border-rose-100 rounded-3xl space-y-5 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 shadow-sm animate-pulse">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 px-4">
          <h2 className="text-rose-900 font-extrabold text-base">⚠️ 시스템 제어 접근 불허 (Access Denied)</h2>
          <p className="text-rose-700 text-xs leading-relaxed">
            관리자 등급 계정이만 접근할 수 있는 영역입니다. 시스템 데이터 누출 및 비공식적인 수정을 방지하기 위해 일반 회원 계정의 접근은 완전히 차단됩니다.
          </p>
        </div>
      </div>
    );
  }

  // --- STATS CALCULATIONS ---
  const totalUsersCount = users.length;
  const totalPostsCount = posts?.length || 0;
  const lostPostsCount = (posts || []).filter(p => p.type === 'lost').length;
  const foundPostsCount = (posts || []).filter(p => p.type === 'found').length;
  const resolvedPostsCount = (posts || []).filter(p => p.resolved).length;
  const unresolvedPostsCount = (posts || []).filter(p => !p.resolved).length;
  const totalReportsCount = reports.length;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const postsTrendData = last7Days.map(dateStr => {
    const count = (posts || []).filter(p => p.createdAt && p.createdAt.startsWith(dateStr)).length;
    const [, month, day] = dateStr.split('-');
    const label = `${month}/${day}`;
    return { label, count };
  });

  const maxPostCount = Math.max(...postsTrendData.map(d => d.count), 1);

  const userRegistrationTrend = React.useMemo(() => {
    const buckets = [
      { label: '26~30일 전', daysStart: 30, daysEnd: 26 },
      { label: '21~25일 전', daysStart: 25, daysEnd: 21 },
      { label: '16~20일 전', daysStart: 20, daysEnd: 16 },
      { label: '11~15일 전', daysStart: 15, daysEnd: 11 },
      { label: '6~10일 전', daysStart: 10, daysEnd: 6 },
      { label: '최근 5일', daysStart: 5, daysEnd: 0 }
    ];

    const now = new Date();
    return buckets.map(b => {
      const count = users.filter(u => {
        if (!u.createdAt) return false;
        const regDate = new Date(u.createdAt);
        const diffMs = now.getTime() - regDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= b.daysEnd && diffDays <= b.daysStart;
      }).length;
      return { label: b.label, count };
    });
  }, [users]);

  const maxUserCount = Math.max(...userRegistrationTrend.map(d => d.count), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      {/* A. ADMIN BANNER HEADER */}
      <div className="bg-slate-900 text-white rounded-3xl shadow-lg p-6 md:p-8 relative overflow-hidden border border-slate-950 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <p className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Integrity Administration Console
          </p>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            학수고대 통합 시스템 관리 패널
          </h2>
          <p className="text-slate-400 text-xs font-medium">
            교내 분실물 유실 방지 플랫폼의 전체 회원 관리, 부정 행위 신고 검토, 콘텐츠 복원과 정리를 일괄 수행할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <button
            type="button"
            onClick={handleRefreshData}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold py-3 px-5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            동기화 새로고침
          </button>
        </div>
      </div>

      {/* ALERT MESSAGES INLINE */}
      {alert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`p-4 rounded-2xl flex items-start gap-3 border ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-155 text-emerald-800'
              : 'bg-rose-50 border-rose-150 text-rose-800'
          }`}
        >
          {alert.type === 'success' ? (
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          )}
          <span className="text-xs font-bold leading-normal">{alert.text}</span>
        </motion.div>
      )}

      {/* C. SYSTEM STATISTICS DASHBOARD */}
      <div id="admin-stats-dashboard" className="bg-slate-50 rounded-3xl border border-slate-200 p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-650" />
              실시간 시스템 통계 & 동향 대시보드
            </h3>
            <p className="text-slate-500 text-xs">플랫폼 내의 활성 지표와 주간 콘텐츠 업로드 흐름을 실시간으로 추적합니다.</p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full shrink-0 max-w-fit">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span className="text-[10px] text-indigo-700 font-extrabold font-mono">Real-time Telemetry</span>
          </div>
        </div>

        {/* 8 Stats Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. 총 가입자 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">총 가입자 수</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-slate-800 font-mono">{totalUsersCount}</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md">학우</span>
            </div>
          </div>

          {/* 2. 총 게시글 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">총 게시글 수</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-slate-800 font-mono">{totalPostsCount}</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md">건</span>
            </div>
          </div>

          {/* 3. 분실물 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">분실물(lost)</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-amber-600 font-mono">{lostPostsCount}</span>
              <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-md">등록</span>
            </div>
          </div>

          {/* 4. 습득물 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-teal-500 uppercase tracking-wider block">습득물(found)</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-teal-600 font-mono">{foundPostsCount}</span>
              <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-md">등록</span>
            </div>
          </div>

          {/* 5. 해결 완료 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block">해결 완료</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-emerald-600 font-mono">{resolvedPostsCount}</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md">완료</span>
            </div>
          </div>

          {/* 6. 해결 미완료 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">해결 미완료</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-rose-600 font-mono">{unresolvedPostsCount}</span>
              <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-md">대기</span>
            </div>
          </div>

          {/* 7. 총 댓글 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">총 댓글 수</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-slate-800 font-mono">{totalComments}</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md">피드</span>
            </div>
          </div>

          {/* 8. 총 신고 접수 수 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-3xs flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">총 신고 접수 수</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl md:text-2xl font-black text-rose-700 font-mono">{totalReportsCount}</span>
              <span className="text-[10px] bg-rose-50/50 text-rose-700 font-bold px-2 py-0.5 rounded-md">신고</span>
            </div>
          </div>
        </div>

        {/* Charts Section (2 Columns Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart 1: 최근 7일간의 게시글 생성 추이 */}
          <div className="bg-white p-5 rounded-3xl border border-slate-150 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                📅 최근 7일간의 게시글 생성 추이
              </h4>
              <p className="text-[10px] text-slate-400">날짜별 새로 등록된 분실물/습득물 통합 추세입니다.</p>
            </div>

            {/* Custom SVG/Bar Chart */}
            <div className="h-32 flex items-end justify-between gap-2 pt-4 px-2">
              {postsTrendData.map((d, index) => {
                const pct = (d.count / maxPostCount) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                    <span className="text-[9px] font-extrabold text-slate-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </span>
                    <div className="w-full bg-slate-50 rounded-t-lg overflow-hidden flex items-end h-20 relative">
                      <div 
                        style={{ height: `${Math.max(pct, 5)}%` }}
                        className="w-full bg-gradient-to-t from-indigo-500 to-indigo-600 rounded-t-lg transition-all duration-500 group-hover:brightness-110"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold font-mono tracking-tighter">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: 최근 30일간의 가입자 가입 추이 */}
          <div className="bg-white p-5 rounded-3xl border border-slate-150 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                📈 최근 30일간의 회원 가입 동향
              </h4>
              <p className="text-[10px] text-slate-400">가입 일자 분포를 구간별 통계로 보여줍니다.</p>
            </div>

            {/* Custom Horizontal Bar Charts */}
            <div className="space-y-2.5 pt-2">
              {userRegistrationTrend.map((d, index) => {
                const pct = (d.count / maxUserCount) * 100;
                return (
                  <div key={index} className="space-y-1 flex flex-col">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                      <span>{d.label}</span>
                      <span className="font-mono font-extrabold text-indigo-700">{d.count}명</span>
                    </div>
                    <div className="h-2 bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${Math.max(pct, 2)}%` }}
                        className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* B. BENTO LAYOUT MODULES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. MEMBER DIRECTORY LIST */}
        <div id="admin-user-mgmt-bento" className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="p-1 px-2.5 bg-rose-50 text-rose-600 rounded-md text-xs font-black">Admin Mode</span>
              👥 전체 가입 학우 계정 목록 조회 및 계정 삭제
              <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                {users.length}명
              </span>
            </h3>

            {loadingUsers ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-5 h-5 text-indigo-650 animate-spin" />
                <p className="text-xs text-slate-400">회원 계정 리스트를 가져오는 중...</p>
              </div>
            ) : users.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center">조회 가능한 가입 학우가 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                {users.map((usr) => (
                  <div key={usr.id} className="flex items-center justify-between py-3.5 px-1.5 hover:bg-slate-50/70 rounded-xl transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{usr.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded-md">
                          ID: {usr.id}
                        </span>
                        {usr.isAdmin && (
                          <span className="text-[10px] bg-rose-50 text-rose-600 font-black px-1.5 py-0.5 rounded-md border border-rose-100">
                            관리자
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        학번: {usr.studentId} | 이메일: {usr.email}
                      </p>
                    </div>

                    {usr.id !== activeUser.id && (
                      <button
                        type="button"
                        onClick={() => handleForceDeleteUser(usr.id, usr.name)}
                        className={`p-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0 border border-rose-150 ${
                          usr.isAdmin ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        title={usr.isAdmin ? '보안 정책에 따라 다른 관리자 계정은 삭제할 수 없습니다' : '이 학우의 모든 데이터와 함께 영구 탈퇴 처리합니다'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        계정 삭제
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. SECURITY REPORT QUEUE AUDIT CONTAINER */}
        <div id="admin-reports-mgmt-bento" className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              🚨 교내 신고 항목 및 원문 검토 대기열
              <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                {reports.length}건
              </span>
            </h3>

            {loadingReports ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-5 h-5 text-indigo-650 animate-spin" />
                <p className="text-xs text-slate-400">신고 접수 내역을 불러오는 중...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-20 text-slate-450 text-xs font-semibold space-y-2">
                <p>정상 상태입니다! 접수된 혹은 검토 대기 중인 신고 항목이 없습니다. ✨</p>
                <p className="text-slate-300 font-medium">학우분들이 투명하고 존중하는 커뮤니티 규칙을 준수하고 있습니다.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`border rounded-2xl p-4.5 transition-all ${
                      report.resolved
                        ? 'border-slate-100 bg-slate-50 opacity-60'
                        : 'border-rose-100 bg-rose-50/20 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase ${
                        report.targetType === 'post'
                          ? 'bg-amber-50 text-amber-850 border border-amber-100'
                          : 'bg-indigo-50 text-indigo-800'
                      }`}>
                        {report.targetType === 'post' ? '게시글 신고' : '댓글 신고'}
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(report.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">신고 접수 유형 / 사유</p>
                        <p className="text-xs font-extrabold text-rose-700 mt-0.5 bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100 inline-block">
                          {report.reason}
                        </p>
                        {report.customReason && (
                          <div className="text-slate-600 font-semibold block mt-1.5 bg-white p-2.5 rounded-xl border border-slate-150 leading-relaxed">
                            {report.customReason}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">신고 대상 원문 / 제목</p>
                        <p className="text-xs text-slate-800 font-semibold mt-0.5 max-h-20 overflow-y-auto bg-white p-2.5 rounded-xl border border-slate-150 line-clamp-3 leading-relaxed">
                          {report.targetTitleOrContent}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-450 font-medium">
                        <span>신고자 ID / 이름: {report.reporterId} ({report.reporterName})</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3">
                      <span className="text-xs font-bold">
                        {report.resolved ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-extrabold">
                            <Check className="w-3.5 h-3.5 stroke-[3px]" /> 처리완료
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold">진행중 (검토대기)</span>
                        )}
                      </span>

                      {!report.resolved && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdminDeleteReportedItem(report)}
                            className="p-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs border-none"
                            title="신고대상 원본 콘텐츠를 완전히 삭제합니다."
                          >
                            <Trash2 className="w-3 h-3" />
                            대상 원문 강제 삭제
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveReport(report.id)}
                            className="p-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs border-none"
                            title="이 신고건을 해결 처리합니다."
                          >
                            <Check className="w-3 h-3" />
                            종료 처리
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border-none"
                            title="신고가 적합하지 않아 기각합니다."
                          >
                            <X className="w-3 h-3" />
                            기각
                          </button>
                        </div>
                      )}
                      
                      {report.resolved && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-1 px-2 text-slate-400 hover:text-slate-600 rounded-md text-[10px] transition-all cursor-pointer font-bold border-none bg-none"
                          title="신고 이력 내역에서 제거"
                        >
                          이력 삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* C. DIALOG MODAL FOR SYSTEM USER FORCED DELETION */}
      <AnimatePresence>
        {userDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserDeleteId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-100 shadow-xl relative z-10 space-y-6 text-slate-850"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">학우 계정을 강제 제명하시겠습니까?</h3>
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                <strong className="text-slate-900">{userDeleteName} ({userDeleteId})</strong> 학우의 계정을 정말로 강제 탈퇴 처리합니까? 
                이 작업은 즉시 데이터베이스 프로필 테이블에서 행을 제거하며, 연쇄 규칙(CASCADE)에 따라 해당 회원이 등록한 분실물 수배 글, 대화 댓글들이 <strong>전부 동시 삭제</strong> 처리됩니다. 이 영구적인 동작은 원상복구할 수 없습니다.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUserDeleteId(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-80 transition-all cursor-pointer border-none"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUserAction}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-rose-100 cursor-pointer border-none"
                >
                  해당 학우 삭제 완료
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
