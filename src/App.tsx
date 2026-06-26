import React, { useState, useEffect } from 'react';
import { User, Post, AppNotification } from './types';
import { getCurrentUser, getPosts, initializeDB, logoutUser, getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from './db';
import RegisterTab from './components/RegisterTab';
import SearchTab from './components/SearchTab';
import MyInfoTab from './components/MyInfoTab';
import PostDetail from './components/PostDetail';
import AdminTab from './components/AdminTab';
import ResetPassword from './components/ResetPassword';
import { Search, PlusCircle, User as UserIcon, LogIn, Sparkles, BookOpen, Clock, ShieldAlert, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import jkLogo from '../JK.png';

type TabType = 'search' | 'register' | 'myinfo' | 'admin';

export default function App() {
  // Navigation states
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  
  // Database states
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  // Time ticker state for visual polish
  const [currentTime, setCurrentTime] = useState(new Date());

  // Notification states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadNotifications = async () => {
    if (activeUser) {
      try {
        const list = await getNotifications(activeUser.id);
        setNotifications(list);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    } else {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications();
    }, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [activeUser]);

  const handleMarkAllAsRead = async () => {
    if (activeUser) {
      await markAllNotificationsAsRead(activeUser.id);
      loadNotifications();
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    await markNotificationAsRead(notif.id);
    loadNotifications();
    if (notif.postId) {
      const targetPost = posts.find(p => p.id === notif.postId);
      if (targetPost) {
        setSelectedPost(targetPost);
        setShowNotifications(false);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Redirect to /reset-password if recovery token is in hash or search params on load
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (
      hash.includes('type=recovery') || 
      hash.includes('access_token=') || 
      search.includes('code=')
    ) {
      if (window.location.pathname !== '/reset-password') {
        const newUrl = window.location.origin + '/reset-password' + search + hash;
        window.history.replaceState(null, '', newUrl);
        setCurrentPath('/reset-password');
      }
    }
  }, []);

  // On mount, initialize fake DB and sessions
  useEffect(() => {
    initializeDB();
    reloadSessionAndPosts();

    // Clock update ticker
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const reloadSessionAndPosts = async () => {
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const user = getCurrentUser();
      setActiveUser(user);
      const latestPosts = await getPosts();
      setPosts(latestPosts);
    } catch (err: any) {
      console.error('reloadSessionAndPosts error:', err);
      setPostsError('데이터베이스에서 목록을 불러오는 도중 오류가 발생했습니다. 아래 새로고침 버튼을 이용해 다시 시도해 주세요.');
    } finally {
      setLoadingPosts(false);
    }
  };

  // Callback after successful login
  const handleLoginSuccess = (user: User) => {
    setActiveUser(user);
    reloadSessionAndPosts();
  };

  // Re-sync post object on comment add, view increment, or state modification
  const handlePostsUpdated = async () => {
    setPostsError(null);
    try {
      const latestPosts = await getPosts();
      setPosts(latestPosts);
      
      // If we're inspecting a post, refresh its details so numbers align
      if (selectedPost) {
        const refreshedPost = latestPosts.find(p => p.id === selectedPost.id);
        setSelectedPost(refreshedPost || null);
      }
    } catch (err: any) {
      console.error('handlePostsUpdated error:', err);
      setPostsError('데이터베이스 상태 동기화 도중 지연이 발생했거나 응답하지 않습니다.');
    }
  };

  const handleLogout = () => {
    logoutUser();
    setActiveUser(null);
    reloadSessionAndPosts();
    setActiveTab('search'); // redirect to search on sign out
  };

  const handleSelectPost = (post: Post) => {
    setSelectedPost(post);
  };

  return (
    <div id="school-lost-and-found-app" className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 pb-12 notranslate" translate="no">
      
      {/* 1. ARCHITECTURAL HEADER & TIMELINE HERO */}
      <header className="bg-white border-b border-slate-150/80 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
  
            {/* Title logo and brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-white border border-slate-100 shrink-0">
                <img 
                  src={jkLogo} 
                  alt="JK 로고" 
                  className="w-full h-full object-contain p-0.5"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex flex-wrap items-center gap-2 underline decoration-indigo-200 underline-offset-4">
                  JKHS Lost & Found
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase hidden sm:inline">
                    Beta-0.3.22
                  </span>
                  {activeUser?.isAdmin && (
                    <span id="admin-mode-indicator" className="text-[11px] bg-rose-600 text-white font-extrabold px-2.5 py-0.5 rounded-md border border-rose-600 tracking-wider shadow-xs animate-pulse">
                      [관리자 모드]
                    </span>
                  )}
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">교내 분실물 조회 및 양방향 소통 플랫폼</p>
              </div>
            </div>

            {/* Middle decorative ticker (Anti-AI-Slop compliant: simple and factual real-time clocks) */}
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-100">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-mono text-slate-500">
                {currentTime.toLocaleString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </span>
            </div>

            {/* Right hand action/user welcome notification */}
            <div className="flex items-center gap-3">
              {activeUser && (
                <div className="relative">
                  <button
                    type="button"
                    id="bell-notification-btn"
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-full transition-all cursor-pointer relative flex items-center justify-center"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-extrabold text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-3xs">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Popover Dropdown */}
                  <AnimatePresence>
                    {showNotifications && (
                      <>
                        {/* Overlay backdrop to close */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowNotifications(false)} 
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-150 shadow-xl z-50 overflow-hidden text-slate-800"
                        >
                          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">알림 센터</span>
                            {unreadCount > 0 && (
                              <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold border-none bg-none cursor-pointer"
                              >
                                모두 읽음
                              </button>
                            )}
                          </div>

                          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                            {notifications.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                                도착한 알림이 없습니다.
                              </div>
                            ) : (
                              notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  onClick={() => handleNotificationClick(notif)}
                                  className={`p-3 text-xs leading-normal transition-all cursor-pointer flex gap-2.5 items-start text-left ${
                                    notif.isRead 
                                      ? 'bg-white hover:bg-slate-50 text-slate-500' 
                                      : 'bg-indigo-50/50 hover:bg-indigo-50 text-slate-800 font-bold border-l-2 border-indigo-500'
                                  }`}
                                >
                                  <div className="space-y-1 w-full">
                                    <p className="line-clamp-3">{notif.message}</p>
                                    <span className="text-[9px] text-slate-400 block font-mono">
                                      {new Date(notif.createdAt).toLocaleTimeString('ko-KR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {activeUser ? (
                <div 
                  id="user-badge-nav"
                  onClick={() => { setActiveTab('myinfo'); setSelectedPost(null); }}
                  className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 hover:border-indigo-200 p-1.5 pr-3.5 rounded-full transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 bg-indigo-600 text-white font-bold rounded-full flex items-center justify-center text-xs text-center select-none shadow-3xs uppercase">
                    {activeUser.name.slice(0, 1)}
                  </div>
                  <span className="text-xs font-bold text-indigo-700 hidden sm:inline">
                    {activeUser.name} 학우
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  id="btn-nav-login"
                  onClick={() => { setActiveTab('myinfo'); setSelectedPost(null); }}
                  className="text-xs font-extrabold text-slate-600 hover:text-indigo-700 bg-slate-100 px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4 shrink-0 text-indigo-500" />
                  간편 가입/로그인
                </button>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 2. THE THREE PERSISTENT TABS NAVIGATION BAR (Click / Touch compliant) */}
      {currentPath !== '/reset-password' && (
        <nav className="bg-white border-b border-slate-100 py-3 sticky top-18 z-30 shadow-xs">
          <div className="max-w-2xl mx-auto px-4 flex items-center justify-between gap-1.5">
            
            <button
              type="button"
              id="tab-btn-search"
              onClick={() => { setActiveTab('search'); setSelectedPost(null); }}
              className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm border transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-xs'
                  : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-750'
              }`}
            >
              <Search className="w-4 h-4 text-indigo-500" />
              <span>분실물 검색</span>
            </button>

            <button
              type="button"
              id="tab-btn-register"
              onClick={() => { setActiveTab('register'); setSelectedPost(null); }}
              className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm border transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-xs'
                  : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-750'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-indigo-500" />
              <span>물건 등록하기</span>
            </button>

            <button
              type="button"
              id="tab-btn-myinfo"
              onClick={() => { setActiveTab('myinfo'); setSelectedPost(null); }}
              className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm border transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'myinfo'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-xs'
                  : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-750'
              }`}
            >
              <UserIcon className="w-4 h-4 text-indigo-500" />
              <span>내 정보 관리</span>
            </button>

            {activeUser?.isAdmin && (
              <button
                type="button"
                id="tab-btn-admin"
                onClick={() => { setActiveTab('admin'); setSelectedPost(null); }}
                className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm border transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-xs'
                    : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-750'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>관리자(Admin)</span>
              </button>
            )}

          </div>
        </nav>
      )}

      {/* 3. DYNAMIC WORKSPACE BODY CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {currentPath === '/reset-password' ? (
          <ResetPassword
            onSuccess={() => {
              // Clean up the URL hash/search and redirect to the root path
              window.history.replaceState(null, '', '/');
              setCurrentPath('/');
              setActiveTab('myinfo'); // set tab to myinfo so the user is greeted with the login form
            }}
          />
        ) : selectedPost ? (
          <PostDetail
            post={selectedPost}
            allPosts={posts}
            activeUser={activeUser}
            onBack={() => setSelectedPost(null)}
            onUpdate={handlePostsUpdated}
            onSelectPost={setSelectedPost}
          />
        ) : (
          <div>
            {/* SEARCH TAB */}
            {activeTab === 'search' && (
              <SearchTab
                posts={posts}
                loading={loadingPosts}
                error={postsError}
                onSelectPost={handleSelectPost}
                onPostUpdated={handlePostsUpdated}
                onRefreshPosts={reloadSessionAndPosts}
              />
            )}

            {/* REGISTER TAB */}
            {activeTab === 'register' && (
              <RegisterTab
                activeUser={activeUser}
                posts={posts}
                onRegisterSuccess={() => {
                  handlePostsUpdated();
                  setActiveTab('search'); // redirect back to search dynamically to see latest post
                }}
              />
            )}

            {/* MY INFO TAB */}
            {activeTab === 'myinfo' && (
              <MyInfoTab
                activeUser={activeUser}
                posts={posts}
                onLoginSuccess={handleLoginSuccess}
                onLogout={handleLogout}
                onViewPost={handleSelectPost}
                onPostsUpdated={handlePostsUpdated}
              />
            )}

            {/* ADMIN TAB */}
            {activeTab === 'admin' && activeUser?.isAdmin && (
              <AdminTab
                activeUser={activeUser}
                posts={posts}
                onViewPost={handleSelectPost}
                onPostsUpdated={handlePostsUpdated}
              />
            )}
          </div>
        )}

      </main>
    </div>
  );
}
