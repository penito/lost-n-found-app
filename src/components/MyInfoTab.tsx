import React, { useState, useEffect } from 'react';
import { User, Post, CATEGORY_TAGS, PostType, Report } from '../types';
import { loginUser, registerUser, logoutUser, updatePost, deletePost, getUsers, deleteUser, updateUserProfile, getReports, resolveReport, deleteReport, deleteComment, findCustomIdByEmail, sendPasswordResetEmail } from '../db';
import { Lock, UserCheck, Mail, BookOpen, Key, LogOut, CheckCircle, AlertCircle, Edit2, Trash2, Tag, MapPin, Eye, FileText, Compass, Camera, Image, Smile, Palette, ShieldAlert, Check, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MyInfoTabProps {
  activeUser: User | null;
  onLoginSuccess: (user: User) => void;
  onLogout: () => void;
  onViewPost: (post: Post) => void;
  posts: Post[];
  onPostsUpdated: () => void;
}

export default function MyInfoTab({ activeUser, onLoginSuccess, onLogout, onViewPost, posts, onPostsUpdated }: MyInfoTabProps) {
  // Navigation states inside MyInfo (if not logged in: 'login' | 'signup')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Input states for Login
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Profile customization states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarEmoji, setEditAvatarEmoji] = useState('🎒');
  const [editProfileColor, setEditProfileColor] = useState('indigo');

  // Admin Reports List States
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Input states for Signup
  const [signupId, setSignupId] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupStudentId, setSignupStudentId] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Find ID & Reset Password states
  const [findEmail, setFindEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Info alerts
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editing state for own post
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editDragActive, setEditDragActive] = useState(false);

  const handleEditFileChange = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAlert({ type: 'error', text: '이미지 파일만 등록 가능합니다.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAlert({ type: 'error', text: '이미지 파일의 크기는 10MB 이하여야 합니다.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setEditImageUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setEditDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setEditDragActive(false);
    }
  };

  const handleEditDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleEditFileChange(e.dataTransfer.files[0]);
    }
  };

  // Admin User List States
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Custom dialog to confirm force deleting a user
  const [userDeleteId, setUserDeleteId] = useState<string | null>(null);
  const [userDeleteName, setUserDeleteName] = useState<string>('');

  const loadUsersList = async () => {
    if (activeUser?.isAdmin) {
      setLoadingUsers(true);
      try {
        const list = await getUsers(activeUser.id);
        setUsers(list || []);
      } catch (err) {
        console.error('Failed to load user records list:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const loadReportsList = async () => {
    if (activeUser?.isAdmin) {
      setLoadingReports(true);
      try {
        const list = await getReports(activeUser.id);
        setReports(list || []);
      } catch (err) {
        console.error('Failed to load reports queue:', err);
      } finally {
        setLoadingReports(false);
      }
    }
  };

  useEffect(() => {
    if (activeUser) {
      setEditProfileName(activeUser.name || '');
      setEditBio(activeUser.bio || '');
      setEditAvatarEmoji(activeUser.avatarEmoji || '🎒');
      setEditProfileColor(activeUser.profileColor || 'indigo');
    }
  }, [activeUser, isEditingProfile]);

  useEffect(() => {
    if (activeUser?.isAdmin) {
      loadUsersList();
      loadReportsList();
    }
  }, [activeUser]);

  const handleForceDeleteUser = (id: string, name: string) => {
    setUserDeleteId(id);
    setUserDeleteName(name);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!activeUser) return;

    if (!editProfileName.trim()) {
      setAlert({ type: 'error', text: '닉네임/성명 입력은 필수입니다.' });
      return;
    }

    try {
      const res = await updateUserProfile(activeUser.id, {
        name: editProfileName.trim(),
        bio: editBio.trim(),
        avatarEmoji: editAvatarEmoji,
        profileColor: editProfileColor
      });

      if (res.success && res.user) {
        setAlert({ type: 'success', text: '프로필이 성공적으로 업데이트되었습니다!' });
        onLoginSuccess(res.user);
        setIsEditingProfile(false);
        onPostsUpdated(); // Trigger refresh to show updated profile on feeds
        setTimeout(() => setAlert(null), 1500);
      } else {
        setAlert({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '프로필 변경 요청 도중 통신 실패가 발생했습니다.' });
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (activeUser?.isAdmin) {
      try {
        const res = await resolveReport(reportId, activeUser.id);
        if (res.success) {
          setAlert({ type: 'success', text: '신고 항목이 처리 완료되었습니다.' });
          await loadReportsList();
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
    if (activeUser?.isAdmin) {
      try {
        const res = await deleteReport(reportId, activeUser.id);
        if (res.success) {
          setAlert({ type: 'success', text: '신고 접수 내역이 반려(기각)되었습니다.' });
          await loadReportsList();
          setTimeout(() => setAlert(null), 1500);
        } else {
          setAlert({ type: 'error', text: res.message });
        }
      } catch {
        setAlert({ type: 'error', text: '신고 기각 과정 중 에러가 발생했습니다.' });
      }
    }
  };

  const handleAdminDeleteReportedItem = async (report: Report) => {
    if (!activeUser?.isAdmin) return;
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
      await loadReportsList();
      onPostsUpdated();
      setTimeout(() => setAlert(null), 1550);
    } catch {
      setAlert({ type: 'error', text: '오류가 발생하여 작업을 중단했습니다.' });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAuth) return;
    setAlert(null);

    if (!loginId.trim() || !loginPassword.trim()) {
      setAlert({ type: 'error', text: '아이디와 비밀번호를 입력해 주세요.' });
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await loginUser(loginId.trim(), loginPassword);
      if (res.success && res.user) {
        setAlert({ type: 'success', text: '환영합니다! 로그인이 완료되었습니다.' });
        setLoginId('');
        setLoginPassword('');
        setTimeout(() => {
          setAlert(null);
          if (res.user) onLoginSuccess(res.user);
        }, 1000);
      } else {
        setAlert({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '로그인 중 통신 실패가 발생했습니다.' });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAuth) return;
    setAlert(null);

    if (!signupId.trim() || !signupName.trim() || !signupStudentId.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setAlert({ type: 'error', text: '모든 항목을 올바르게 채워 주세요.' });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail.trim())) {
      setAlert({ type: 'error', text: '올바른 이메일 주소 형식을 입력해 주세요.' });
      return;
    }

    // Student ID validation
    if (!/^\d+$/.test(signupStudentId.trim())) {
      setAlert({ type: 'error', text: '학번은 숫자만 입력해 주세요.' });
      return;
    }

    const newUser: User = {
      id: signupId.trim().toLowerCase(),
      name: signupName.trim(),
      studentId: signupStudentId.trim(),
      email: signupEmail.trim(),
      password: signupPassword,
    };

    setIsSubmittingAuth(true);
    try {
      const res = await registerUser(newUser);
      if (res.success) {
        setAlert({ type: 'success', text: '가입을 축하합니다! 로그인 후 이용해 주세요.' });
        // Reset inputs
        setSignupId('');
        setSignupName('');
        setSignupStudentId('');
        setSignupEmail('');
        setSignupPassword('');
        setTimeout(() => {
          setAlert(null);
          setAuthMode('login'); // switch to login pane
        }, 1500);
      } else {
        setAlert({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '가입 가공 중 문제가 발생했습니다.' });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleFindId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAuth) return;
    setAlert(null);

    if (!findEmail.trim()) {
      setAlert({ type: 'error', text: '이메일 주소를 입력해 주세요.' });
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await findCustomIdByEmail(findEmail.trim());
      if (res.success && res.customId) {
        setAlert({ 
          type: 'success', 
          text: `학우님의 등록된 아이디는 [ ${res.customId} ] 입니다. 이 아이디로 로그인을 진행해 주세요.` 
        });
        setFindEmail('');
      } else {
        setAlert({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '아이디 조회 중 에러가 발생했습니다.' });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingAuth) return;
    setAlert(null);

    if (!resetEmail.trim()) {
      setAlert({ type: 'error', text: '이메일 주소를 입력해 주세요.' });
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const res = await sendPasswordResetEmail(resetEmail.trim());
      if (res.success) {
        setAlert({ type: 'success', text: res.message });
        setResetEmail('');
      } else {
        setAlert({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '비밀번호 재설정 이메일 전송 중 에러가 발생했습니다.' });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
    setAlert(null);
  };

  // Editing logic triggers
  const startEditPost = (post: Post) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditLocation(post.location);
    setEditTags(post.tags);
    setEditDescription(post.description);
    setEditImageUrl(post.imageUrl || '');
  };

  const handleEditTagToggle = (tag: string) => {
    if (editTags.includes(tag)) {
      setEditTags(editTags.filter(t => t !== tag));
    } else {
      if (editTags.length < 4) {
        setEditTags([...editTags, tag]);
      }
    }
  };

  const saveEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    if (!editTitle.trim() || !editLocation.trim() || !editDescription.trim() || editTags.length === 0) {
      setAlert({ type: 'error', text: '모든 필수 항목을 입력하고 카테고리를 1개 이상 골라주세요.' });
      return;
    }

    try {
      await updatePost(editingPost.id, {
        title: editTitle.trim(),
        location: editLocation.trim(),
        tags: editTags,
        description: editDescription.trim(),
        imageUrl: editImageUrl || undefined
      });

      setEditingPost(null);
      setEditImageUrl('');
      onPostsUpdated();
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '게시글 수정 처리에 실패했습니다.' });
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openDeleteConfirmDialog = (postId: string) => {
    setDeleteConfirmId(postId);
  };

  const confirmDeletePostItem = async () => {
    if (deleteConfirmId) {
      try {
        await deletePost(deleteConfirmId);
        setDeleteConfirmId(null);
        onPostsUpdated();
      } catch (errBy: any) {
        setAlert({ type: 'error', text: '게시글 삭제 처리에 실패했습니다.' });
      }
    }
  };

  const confirmDeleteUserAction = async () => {
    if (userDeleteId && activeUser) {
      try {
        const res = await deleteUser(userDeleteId, activeUser.id);
        if (res.success) {
          setUserDeleteId(null);
          setAlert({ type: 'success', text: `${userDeleteName} 학우 계정이 성공적으로 강제 탈퇴 처리되었습니다.` });
          await loadUsersList();
          onPostsUpdated();
        } else {
          setAlert({ type: 'error', text: res.message || '사용자 삭제 처리가 실패했습니다.' });
        }
      } catch (err: any) {
        setAlert({ type: 'error', text: err.message || '사용자 삭제 과정 중 오류가 발생했습니다.' });
      }
    }
  };

  // Filter posts based on user authority (admin sees all posts, regular user sees own posts)
  const myPosts = activeUser?.isAdmin
    ? posts
    : posts.filter(post => activeUser && post.authorId === activeUser.id);

  return (
    <div id="my-info-tab-wrapper" className="max-w-2xl mx-auto py-4 px-1">
      
      {/* 1. NOT LOGGED IN VIEW */}
      {!activeUser && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-205 border-slate-200 overflow-hidden">
          
          {/* Internal sub-navigation tabs (Login / Register) */}
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button
              type="button"
              id="switch-auth-login"
              onClick={() => { setAuthMode('login'); setAlert(null); }}
              className={`flex-1 py-4.5 text-center text-sm font-bold transition-all duration-200 cursor-pointer ${
                authMode === 'login' || authMode === 'find_id' || authMode === 'reset_password'
                  ? 'bg-white border-b-2 border-indigo-600 text-indigo-700 font-extrabold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              로그인하기 <span className="font-normal text-xs">(Sign In)</span>
            </button>
            <button
              type="button"
              id="switch-auth-signup"
              onClick={() => { setAuthMode('signup'); setAlert(null); }}
              className={`flex-1 py-4.5 text-center text-sm font-bold transition-all duration-200 cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white border-b-2 border-indigo-600 text-indigo-700 font-extrabold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              간편 회원가입 <span className="font-normal text-xs">(Sign Up)</span>
            </button>
          </div>

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {/* Alert message displays */}
              {alert && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  id="auth-alert-message"
                  className={`p-3.5 mb-6 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
                    alert.type === 'success'
                      ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {alert.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{alert.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* A. LOGIN INTERFACE */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-id" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    아이디
                  </label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                    <input
                      id="login-id"
                      type="text"
                      required
                      placeholder="아이디를 입력해 주세요"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    비밀번호
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                    <input
                      id="login-password"
                      type="password"
                      required
                      placeholder="비밀번호"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-submit-login"
                  disabled={isSubmittingAuth}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-md shadow-indigo-100 cursor-pointer mt-4 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingAuth ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
                      <span>로그인 중...</span>
                    </>
                  ) : (
                    '로그인 완료'
                  )}
                </button>

                <div className="flex items-center justify-between text-xs px-1 pt-2 border-t border-slate-100/80 mt-2">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('find_id'); setAlert(null); }}
                    className="text-slate-500 hover:text-indigo-650 font-bold transition-colors cursor-pointer"
                  >
                    🔍 아이디 찾기
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('reset_password'); setAlert(null); }}
                    className="text-slate-500 hover:text-indigo-650 font-bold transition-colors cursor-pointer"
                  >
                    🔒 비밀번호 재설정
                  </button>
                </div>
              </form>
            )}

            {/* C. FIND ID INTERFACE */}
            {authMode === 'find_id' && (
              <form onSubmit={handleFindId} className="space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-sm text-slate-800">아이디 찾기</h3>
                  <p className="text-xs text-slate-500 leading-normal">
                    본인의 가입 시 등록하신 이메일 주소를 정확히 작성해 주세요. DB에서 연동된 학우님의 고유 아이디를 즉시 복원해 드립니다.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="find-email" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    이메일 주소
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                    <input
                      id="find-email"
                      type="email"
                      required
                      placeholder="example@email.com"
                      value={findEmail}
                      onChange={(e) => setFindEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-md shadow-indigo-100 cursor-pointer mt-4 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingAuth ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
                      <span>조회 중...</span>
                    </>
                  ) : (
                    '아이디 확인하기'
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAlert(null); }}
                    className="text-xs font-bold text-slate-450 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    로그인 전용 화면으로 돌아가기
                  </button>
                </div>
              </form>
            )}

            {/* D. PASSWORD RESET INTERFACE */}
            {authMode === 'reset_password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-sm text-slate-800">비밀번호 재설정 이메일 전송</h3>
                  <p className="text-xs text-slate-500 leading-normal">
                    비밀번호를 재설정할 수 있는 보안 토큰 메일을 가입하신 이메일 수신함으로 전송해 드립니다. 메일 본문의 링크를 클릭하여 새로운 주키(key)를 지정해 주세요.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    이메일 주소
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      placeholder="example@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-md shadow-indigo-100 cursor-pointer mt-4 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingAuth ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
                      <span>재설정 메일 전송 중...</span>
                    </>
                  ) : (
                    '재설정 보안 메일 요청하기'
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAlert(null); }}
                    className="text-xs font-bold text-slate-450 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    로그인 전용 화면으로 돌아가기
                  </button>
                </div>
              </form>
            )}

            {/* B. SIGNUP INTERFACE */}
            {authMode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="signup-id" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    아이디
                  </label>
                  <input
                    id="signup-id"
                    type="text"
                    required
                    placeholder="사용하실 고유 아이디 (영문/숫자)"
                    value={signupId}
                    onChange={(e) => setSignupId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-name" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    본명 (실명)
                  </label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      placeholder="예시: 홍길동"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="signup-student-id" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      학번
                    </label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                      <input
                        id="signup-student-id"
                        type="text"
                        required
                        placeholder="예시: 202410123"
                        value={signupStudentId}
                        onChange={(e) => setSignupStudentId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="signup-email" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      이메일 주소
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                      <input
                        id="signup-email"
                        type="email"
                        required
                        placeholder="ex) mail@domain.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    비밀번호 설정
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                    <input
                      id="signup-password"
                      type="password"
                      required
                      placeholder="보안 비밀번호 설정"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-submit-signup"
                  disabled={isSubmittingAuth}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-md shadow-indigo-100 cursor-pointer mt-4 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingAuth ? (
                    <>
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
                      <span>가입 처리 중...</span>
                    </>
                  ) : (
                    '기입 완료 및 가입'
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* 2. LOGGED IN DASHBOARD VIEW */}
      {activeUser && !editingPost && (
        <div className="space-y-6">
          
          {/* A. Dynamic Profiling Panel - Slate-900 Bento styling with custom themes */}
          {(() => {
            const themeMap = {
              indigo: {
                cardBg: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border border-indigo-600/20',
                accentText: 'text-indigo-400',
                avatarBg: 'bg-indigo-600 border border-indigo-500',
                glowColor: 'bg-indigo-500/10',
                btnTheme: 'bg-indigo-700/40 hover:bg-indigo-700/60 text-white'
              },
              rose: {
                cardBg: 'bg-gradient-to-br from-slate-900 via-rose-950 to-slate-950 border border-rose-600/20',
                accentText: 'text-rose-400',
                avatarBg: 'bg-rose-600 border border-rose-500',
                glowColor: 'bg-rose-500/10',
                btnTheme: 'bg-rose-700/40 hover:bg-rose-700/60 text-white'
              },
              emerald: {
                cardBg: 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 border border-emerald-600/20',
                accentText: 'text-emerald-400',
                avatarBg: 'bg-emerald-600 border border-emerald-500',
                glowColor: 'bg-emerald-500/10',
                btnTheme: 'bg-emerald-700/40 hover:bg-emerald-700/60 text-white'
              },
              amber: {
                cardBg: 'bg-gradient-to-br from-slate-900 via-amber-950 to-slate-950 border border-amber-600/20',
                accentText: 'text-amber-400',
                avatarBg: 'bg-amber-600 border border-amber-500',
                glowColor: 'bg-amber-500/10',
                btnTheme: 'bg-amber-700/40 hover:bg-amber-700/60 text-slate-100'
              },
              violet: {
                cardBg: 'bg-gradient-to-br from-slate-900 via-violet-950 to-slate-950 border border-violet-600/20',
                accentText: 'text-violet-400',
                avatarBg: 'bg-violet-600 border border-violet-500',
                glowColor: 'bg-violet-500/10',
                btnTheme: 'bg-violet-700/40 hover:bg-violet-700/60 text-white'
              },
              sky: {
                cardBg: 'bg-gradient-to-br from-slate-900 via-sky-950 to-slate-950 border border-sky-600/20',
                accentText: 'text-sky-400',
                avatarBg: 'bg-sky-600 border border-sky-500',
                glowColor: 'bg-sky-500/10',
                btnTheme: 'bg-sky-700/40 hover:bg-sky-700/60 text-white'
              }
            };
            
            const currentTheme = themeMap[(activeUser.profileColor as keyof typeof themeMap) || 'indigo'] || themeMap.indigo;

            return isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className={`${currentTheme.cardBg} text-white rounded-3xl shadow-sm p-6 md:p-8 relative overflow-hidden space-y-6 border`}>
                <div className={`${currentTheme.glowColor} absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none`} />
                
                <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
                  <h4 className="text-sm font-extrabold flex items-center gap-2 text-white">
                    <Sparkles className={`w-4 h-4 ${currentTheme.accentText} animate-spin-slow`} />
                    나만의 프로필 꾸미기 디자인
                  </h4>
                  <button
                    type="button"
                    onClick={() => { setIsEditingProfile(false); setAlert(null); }}
                    className="text-white/40 hover:text-white px-2.5 py-1 rounded-lg text-xs cursor-pointer font-bold transition-all bg-white/5"
                  >
                    취소
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">이름 / 닉네임</label>
                    <input
                      type="text"
                      required
                      value={editProfileName}
                      onChange={(e) => setEditProfileName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-hidden focus:ring-2 focus:ring-white/15 text-xs font-medium"
                      placeholder="학우님의 닉네임이나 실명을 적어주세요."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">한 줄 상태 소개 (명언/소개)</label>
                    <input
                      type="text"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-hidden focus:ring-2 focus:ring-white/15 text-xs font-medium"
                      placeholder="소개글을 적어 꾸며보세요. (예: 분실물 사냥꾼!)"
                      maxLength={60}
                    />
                  </div>
                </div>

                <div className="space-y-2 relative z-10">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">대표 아바타 이모지 설정</label>
                  <div className="flex flex-wrap gap-2 bg-white/5 p-4 rounded-2xl border border-white/10 max-h-36 overflow-y-auto">
                    {['🎒', '💻', '📱', '🎓', '⚡', '🍀', '🦁', '🐯', '🐼', '🦊', '🐱', '🐶', '🎨', '⚽', '📚', '🖊️', '🎵', '🎮', '🌟', '🍩', '🚀', '🔥', '💖', '🌈'].map(emo => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => setEditAvatarEmoji(emo)}
                        className={`w-9 h-9 rounded-xl text-base flex items-center justify-center transition-all cursor-pointer ${
                          editAvatarEmoji === emo 
                            ? `${currentTheme.avatarBg} scale-110 shadow-lg` 
                            : 'hover:bg-white/10 bg-white/5 text-slate-350'
                        }`}
                      >
                        {emo}
                      </button>
                    ))}
                    <input
                      type="text"
                      placeholder="입력"
                      maxLength={4}
                      value={editAvatarEmoji}
                      onChange={(e) => setEditAvatarEmoji(e.target.value)}
                      className="w-16 h-9 text-center bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/20 focus:ring-1 focus:ring-white/20 focus:outline-hidden font-bold"
                      title="직접 글자나 이모지를 적어보세요."
                    />
                  </div>
                </div>

                <div className="space-y-2 relative z-10">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">프로필 카드 테마 컬러 설정</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {Object.keys(themeMap).map(col => {
                      const isSel = editProfileColor === col;
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setEditProfileColor(col)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold capitalize transition-all border shrink-0 cursor-pointer ${
                            isSel 
                              ? 'bg-white text-slate-900 border-white font-extrabold shadow-sm' 
                              : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-3 relative z-10 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { setIsEditingProfile(false); setAlert(null); }}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    돌아가기 (취소)
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-950 py-3 rounded-xl text-xs font-extrabold transition-all shadow-md cursor-pointer"
                  >
                    프로필 설정값 저장하기
                  </button>
                </div>
              </form>
            ) : (
              <div className={`${currentTheme.cardBg} text-white rounded-3xl shadow-sm p-6 md:p-8 relative overflow-hidden flex flex-col justify-between border`}>
                <div className={`${currentTheme.glowColor} absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none`} />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-3xl select-none shadow-inner shrink-0 scale-95">
                      {activeUser.avatarEmoji || activeUser.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className={`text-[10px] font-extrabold ${currentTheme.accentText} uppercase tracking-widest flex items-center gap-1`}>
                        <Sparkles className="w-3 h-3" />
                        Jinkwang Member Portal
                      </p>
                      <h3 id="user-profile-title" className="text-xl font-extrabold flex items-center gap-2 mt-0.5">
                        {activeUser.name} <span className="text-slate-400 text-xs font-bold leading-none bg-white/5 px-2 py-0.5 rounded-md">학우님</span>
                      </h3>
                      <p className="text-slate-400 text-xs font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>학번: {activeUser.studentId}</span>
                        <span className="text-white/10 hidden sm:inline">|</span>
                        <span>이메일: {activeUser.email}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => { setIsEditingProfile(true); setAlert(null); }}
                      className={`inline-flex items-center gap-1.5 ${currentTheme.btnTheme} text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer border border-white/5`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      꾸미기
                    </button>
                    
                    <button
                      type="button"
                      id="btn-user-logout"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/90 border border-white/5 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      로그아웃
                    </button>
                  </div>
                </div>

                {/* Profile Bio Row */}
                <div className="mt-4 relative z-10 bg-white/5 border border-white/5 rounded-2xl p-3.5 text-xs">
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">한 줄 상태 소개</p>
                  <p className="text-slate-200 font-medium">
                    {activeUser.bio || '등록된 한 줄 소개가 없습니다. 꾸미기 버튼을 눌러 소개글을 채워보세요! ✨'}
                  </p>
                </div>

                {/* B. Bento Statistics Counters */}
                <div className="mt-4 grid grid-cols-2 gap-4 relative z-10">
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl hover:bg-white/8 transition-all">
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider">내가 작성한 글</p>
                    <p className={`text-2xl font-black mt-1 ${currentTheme.accentText}`}>{myPosts.length}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl hover:bg-white/8 transition-all">
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider">해결 완료 건수</p>
                    <p className="text-2xl font-black mt-1 text-emerald-400">
                      {myPosts.filter(p => p.resolved).length}
                    </p>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* C. Retrieve & Modify Own Authored Posts List */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              내가 작성한 게시글 조회 및 수정
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                {myPosts.length}개
              </span>
            </h3>

            {myPosts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs leading-relaxed space-y-2">
                <p>회원님이 직접 게시판에 등록한 소중한 분실/습득글이 아직 없습니다.</p>
                <p className="text-slate-300 font-medium">"등록 탭"에서 분실물을 게시하거나 수배를 의뢰해 보세요!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myPosts.map((post, ind) => (
                  <div
                    key={post.id}
                    id={`my-post-card-${ind}`}
                    className="border border-slate-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-xs transition-all duration-300 relative group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${
                          post.type === 'found'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {post.type === 'found' ? '습득물' : '분실물'}
                        </span>
                        
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${
                          post.resolved
                            ? 'bg-slate-900 text-white'
                            : 'bg-amber-50 text-amber-800 border border-amber-100'
                        }`}>
                          {post.resolved ? '해결됨' : '진행중'}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-sm mb-2 transition-all duration-150" onClick={() => onViewPost(post)}>
                      {post.title}
                    </h4>

                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-4">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      {post.location}
                    </p>

                    <div className="flex items-center justify-between mt-1 border-t border-dashed border-slate-100 pt-3.5">
                      {/* Interaction buttons */}
                      <div className="flex flex-wrap gap-1">
                        {post.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-semibold bg-indigo-50/50 text-indigo-700 px-2 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 transition-all">
                        <button
                          type="button"
                          id={`btn-edit-post-${post.id}`}
                          onClick={() => startEditPost(post)}
                          className="p-1.5 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          수정
                        </button>
                        <button
                          type="button"
                          id={`btn-delete-mypost-${post.id}`}
                          onClick={() => openDeleteConfirmDialog(post.id)}
                          className="p-1.5 px-3 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          삭제
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* D. ADMIN PANEL: USER MANAGEMENT CONTROLS */}
          {activeUser?.isAdmin && (
            <div id="admin-user-mgmt-bento" className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                <span className="p-1 px-2.5 bg-rose-50 text-rose-600 rounded-md text-xs font-black">Admin Mode</span>
                👥 전체 가입 학우 계정 목록 조회 및 계정 삭제
                <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  {users.length}명
                </span>
              </h3>

              {loadingUsers ? (
                <p className="text-xs text-slate-400 py-6 text-center animate-pulse">회원 계정 리스트를 가져오는 중...</p>
              ) : users.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">조회 가능한 다른 가입 학우가 없습니다.</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1 space-y-3">
                  {users.map((usr) => (
                    <div key={usr.id} className="flex items-center justify-between py-3 px-1 hover:bg-slate-50 rounded-xl transition-all">
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
                          className="p-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 border border-rose-150"
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
          )}

          {/* E. ADMIN PANEL: REPORTED ITEMS AUDIT CONTROLS */}
          {activeUser?.isAdmin && (
            <div id="admin-reports-mgmt-bento" className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                🚨 교내 신고 항목 및 원문 검토 대기열
                <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  {reports.length}건
                </span>
              </h3>

              {loadingReports ? (
                <p className="text-xs text-slate-400 py-6 text-center animate-pulse">신고 접수 내역을 불러오는 중...</p>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-slate-450 text-xs font-medium">
                  <p>정상 상태입니다! 접수된 혹은 검토 대기 중인 신고 항목이 없습니다. ✨</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className={`border rounded-2xl p-4 transition-all ${
                        report.resolved
                          ? 'border-slate-100 bg-slate-50 opacity-60'
                          : 'border-rose-100 bg-rose-50/20 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase ${
                          report.targetType === 'post'
                            ? 'bg-amber-150 bg-amber-50 text-amber-800'
                            : 'bg-indigo-50 text-indigo-800'
                        }`}>
                          {report.targetType === 'post' ? '게시글 신고' : '댓글 신고'}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(report.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400">신고 접수 유형 / 사유</p>
                          <p className="text-xs font-bold text-rose-700 mt-0.5">
                            {report.reason}
                            {report.customReason && <span className="text-slate-600 font-medium block mt-1 bg-white p-2 rounded-lg border border-slate-150">{report.customReason}</span>}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 font-mono">신고 대상 원문 / 제목</p>
                          <p className="text-xs text-slate-800 font-medium mt-0.5 max-h-20 overflow-y-auto bg-white p-2 rounded-lg border border-slate-150 line-clamp-3">
                            {report.targetTitleOrContent}
                          </p>
                        </div>

                        <div className="text-[10px] text-slate-450">
                          <span>신고자 ID / 이름: {report.reporterId} ({report.reporterName})</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3">
                        <span className="text-xs font-bold">
                          {report.resolved ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> 처리완료
                            </span>
                          ) : (
                            <span className="text-amber-600">진행중 (검토대기)</span>
                          )}
                        </span>

                        {!report.resolved && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdminDeleteReportedItem(report)}
                              className="p-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              title="신고대상 원본 콘텐츠를 완전히 삭제합니다."
                            >
                              <Trash2 className="w-3 h-3" />
                              대상 콘텐츠 삭제
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveReport(report.id)}
                              className="p-1 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              title="이 신고건을 해결 처리합니다."
                            >
                              <Check className="w-3 h-3" />
                              해결 처리
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1"
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
                            className="p-1 px-2 text-slate-400 hover:text-slate-600 rounded-md text-[10px] transition-all cursor-pointer font-bold"
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
          )}

        </div>
      )}

      {/* 3. INLINE EDITING PANE FOR POSTS */}
      {activeUser && editingPost && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-600" />
              게시글 수정하기
            </h3>
            <button
              onClick={() => setEditingPost(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-sm text-xs cursor-pointer font-bold"
            >
              취소
            </button>
          </div>

          <form onSubmit={saveEditPost} className="space-y-5">
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                글 제목
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 font-medium transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                발견/분실 위치 정보
              </label>
              <input
                type="text"
                required
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 font-medium transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                카테고리 태그 수정 (최대 4개)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TAGS.map(tag => {
                  const isSel = editTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleEditTagToggle(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                        isSel
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Edit Image Upload Area */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-450" />
                부착 이미지 수정 <span className="text-[10px] text-slate-400 font-normal lowercase">(선택 사항)</span>
              </label>
              
              {editImageUrl ? (
                <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-56 flex justify-center items-center">
                  <img 
                    src={editImageUrl} 
                    alt="수정할 첨부 이미지" 
                    className="max-h-56 w-auto object-contain rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl('')}
                    className="absolute top-3 right-3 p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center border-none"
                    title="이미지 제거"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragEnter={handleEditDrag}
                  onDragOver={handleEditDrag}
                  onDragLeave={handleEditDrag}
                  onDrop={handleEditDrop}
                  onClick={() => document.getElementById('edit-image-file-input')?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1.5 select-none ${
                    editDragActive 
                      ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700' 
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/60'
                  }`}
                >
                  <input 
                    type="file" 
                    id="edit-image-file-input" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleEditFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="p-2 bg-white rounded-full shadow-3xs border border-slate-100 text-slate-400">
                    <Image className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-700">기기에 있는 새로운 사진 올리기 또는 드롭</p>
                    <p className="text-[10px] text-slate-400">JPG, PNG, GIF 등 지원 (최대 10MB)</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                상세 설명 수정
              </label>
              <textarea
                rows={4}
                required
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 resize-none font-medium transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-850 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                변경취소
              </button>
              <button
                type="submit"
                id="btn-save-post-edit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-100 cursor-pointer"
              >
                수정 완료 저장
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Custom Sleek State Confirmation Dialog for secure deletion */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            {/* Box */}
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
                <h3 className="text-lg font-bold text-slate-900">게시글을 삭제하시겠습니까?</h3>
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                이 게시글을 정말로 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없으며 관련된 모든 댓글도 함께 영구 삭제됩니다.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePostItem}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  삭제 완료
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Dialog for Force deleting a user */}
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
                <h3 className="text-lg font-bold text-slate-900">학우 계정을 강제 삭제하시겠습니까?</h3>
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                <strong className="text-slate-900">{userDeleteName} ({userDeleteId})</strong> 학우의 계정을 정말로 강제 삭제하시겠습니까? 
                이 작업은 즉시 데이터베이스에 반영되며, 해당 사용자가 작성한 모든 게시글과 내용 및 댓글들이 함께 <strong>영구 삭제</strong>됩니다. 이 동작은 복구할 수 없습니다.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUserDeleteId(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-80 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUserAction}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  계정 삭제 확정
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
