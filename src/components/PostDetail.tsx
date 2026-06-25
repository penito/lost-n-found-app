import React, { useState, useEffect } from 'react';
import { Post, Comment, User } from '../types';
import { getCommentsForPost, addComment, deleteComment, updatePost, getCurrentUser, deletePost, submitReport } from '../db';
import { X, Calendar, MapPin, Tag, User as UserIcon, MessageSquare, Check, HelpCircle, AlertCircle, ArrowLeft, Trash2, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { findMatchesForPost } from '../matching';

interface PostDetailProps {
  post: Post;
  allPosts: Post[];
  activeUser: User | null;
  onBack: () => void;
  onUpdate: () => void; // Trigger list reload when post stats updated (deleted/resolved/etc.)
  onSelectPost?: (post: Post) => void;
}

export default function PostDetail({ post, allPosts, activeUser, onBack, onUpdate, onSelectPost }: PostDetailProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  // Calculate related matches of opposite type
  const relatedMatches = React.useMemo(() => {
    return findMatchesForPost(post, allPosts || [], 0.25).slice(0, 4);
  }, [post, allPosts]);
  
  // Custom display name/student ID for Guest comment writes
  const [guestName, setGuestName] = useState('');
  const [guestStudentId, setGuestStudentId] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  // States for sandbox-safe custom deletion confirmation dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(null);

  // Custom Report Dialog States
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<'post' | 'comment' | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string>('');
  const [reportTargetContent, setReportTargetContent] = useState<string>('');
  const [reportReason, setReportReason] = useState<string>('상업적 광고 / 도배 행위');
  const [reportCustomReason, setReportCustomReason] = useState<string>('');
  const [reportResultMsg, setReportResultMsg] = useState<{ type: 'success' | 'err'; text: string } | null>(null);

  useEffect(() => {
    loadComments();
    // Scroll detail container to top
    const elem = document.getElementById('post-detail-scroll-pane');
    if (elem) elem.scrollTop = 0;
  }, [post.id]);

  const loadComments = async () => {
    try {
      const thread = await getCommentsForPost(post.id);
      setComments(thread || []);
    } catch (e) {
      console.error('Failed to load comments thread:', e);
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!newCommentText.trim()) {
      setErrorText('댓글 내용을 입력해 주세요.');
      return;
    }

    let commentAuthor: User;

    if (activeUser) {
      commentAuthor = activeUser;
    } else {
      if (!guestName.trim()) {
        setErrorText('비로그인 댓글 작성 시 성명을 입력해 주세요.');
        return;
      }
      if (!guestStudentId.trim()) {
        setErrorText('비로그인 댓글 작성 시 학번을 입력해 주세요.');
        return;
      }
      commentAuthor = {
        id: `guest-${Date.now()}`,
        name: guestName.trim() + ' (게스트)',
        studentId: guestStudentId.trim(),
        email: 'guest@school.ac.kr',
      };
    }

    try {
      await addComment(post.id, commentAuthor, newCommentText.trim());
      setNewCommentText('');
      
      // Clear guests state after comment
      if (!activeUser) {
        setGuestName('');
        setGuestStudentId('');
      }

      await loadComments();
      onUpdate(); // Let search know a comment was added / views refreshed
    } catch (err) {
      setErrorText('댓글 등록에 실패했습니다.');
    }
  };

  const handleDeleteCommentItem = (commentId: string) => {
    setCommentToDeleteId(commentId);
  };

  const confirmDeleteComment = async () => {
    if (commentToDeleteId) {
      try {
        await deleteComment(commentToDeleteId);
        setCommentToDeleteId(null);
        await loadComments();
      } catch (err) {
        setErrorText('댓글 삭제에 실패했습니다.');
      }
    }
  };

  const triggerReport = (type: 'post' | 'comment', id: string, sampleContent: string) => {
    setReportTargetType(type);
    setReportTargetId(id);
    setReportTargetContent(sampleContent);
    setReportReason('상업적 광고 / 도배 행위');
    setReportCustomReason('');
    setReportResultMsg(null);
    setShowReportDialog(true);
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetType || !reportTargetId) return;

    let reporterId = 'guest';
    let reporterName = '게스트';
    if (activeUser) {
      reporterId = activeUser.id;
      reporterName = activeUser.name;
    }

    try {
      const res = await submitReport({
        targetId: reportTargetId,
        targetType: reportTargetType,
        targetTitleOrContent: reportTargetContent.substring(0, 150),
        reason: reportReason,
        customReason: reportReason === '기타 (직접 작성)' ? reportCustomReason : undefined,
        reporterId,
        reporterName
      });

      if (res.success) {
        setReportResultMsg({ type: 'success', text: '신고가 정상적으로 접수되었습니다. 관리자가 신속하게 조치를 취하겠습니다!' });
        setTimeout(() => {
          setShowReportDialog(false);
          setReportResultMsg(null);
        }, 2200);
      } else {
        setReportResultMsg({ type: 'err', text: res.message });
      }
    } catch {
      setReportResultMsg({ type: 'err', text: '통신 처리 도중 에러가 발견되었습니다.' });
    }
  };

  const handleToggleResolved = async () => {
    const nextResolvedState = !post.resolved;
    try {
      await updatePost(post.id, { resolved: nextResolvedState });
      onUpdate();
    } catch (err) {
      setErrorText('해결 여부 변경에 실패했습니다.');
    }
  };

  const handleDeletePost = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = async () => {
    try {
      await deletePost(post.id);
      setShowDeleteConfirm(false);
      onUpdate();
      onBack();
    } catch (err) {
      setErrorText('게시글 삭제에 실패했습니다.');
    }
  };

  const isAuthor = activeUser && (post.authorId === activeUser.id || activeUser.isAdmin);

  return (
    <div id="post-detail-root" className="max-w-3xl mx-auto py-2">
      {/* Return button row */}
      <button
        type="button"
        id="btn-detail-back"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 py-2 px-4 rounded-xl transition-all cursor-pointer font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        게시글 목록으로 돌아가기
      </button>

      {/* Main Panel */}
      <div id="post-detail-scroll-pane" className="bg-white rounded-2xl shadow-xs border border-neutral-100 overflow-hidden">
        
        {/* Banner header colored based on Post Type */}
        <div id="detail-banner-tint" className={`h-2.5 w-full ${post.type === 'found' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

        <div className="p-6 md:p-8">
          
          {/* Post Heading Status Badge / Date */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            
            <div className="flex items-center gap-2">
              <span id="detail-badge-type" className={`text-xs font-bold px-3 py-1 rounded-full ${
                post.type === 'found'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                {post.type === 'found' ? '습득물' : '분실물'}
              </span>

              <span id="detail-badge-resolved" className={`text-xs font-semibold px-3 py-1 rounded-full ${
                post.resolved
                  ? 'bg-neutral-800 text-white'
                  : 'bg-amber-50 text-amber-800 border border-amber-100'
              }`}>
                {post.resolved ? '해결 완료' : '진행 중'}
              </span>
            </div>

            <div className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.createdAt).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Title Text */}
          <h1 id="detail-post-title" className="text-xl md:text-2xl font-bold text-neutral-950 mb-6 leading-snug">
            {post.title}
          </h1>

          {/* Author info Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-xl mb-6 text-sm border border-neutral-100">
            
            <div className="flex items-start gap-2.5">
              <UserIcon className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-neutral-400 text-xs font-medium">
                  {post.type === 'found' ? '발견자' : '분실자'}
                </p>
                <p className="font-bold text-neutral-800 mt-0.5">
                  {post.reporterName}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-neutral-200 text-neutral-600 rounded-sm mt-1">ID</span>
              <div>
                <p className="text-neutral-400 text-xs font-medium">학번</p>
                <p className="font-mono font-bold text-neutral-800 mt-0.5">
                  {post.reporterStudentId}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-neutral-400 text-xs font-medium">위치 상세</p>
                <p className="font-bold text-neutral-800 mt-0.5 max-w-[160px] truncate" title={post.location}>
                  {post.location}
                </p>
              </div>
            </div>

          </div>

          {/* Text Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-800 mb-2.5 flex items-center gap-1.5 border-b border-neutral-100 pb-1.5">
              상세 설명 및 안내
            </h3>
            
            {post.imageUrl && (
              <div className="mb-4 rounded-xl overflow-hidden border border-neutral-250 bg-neutral-50 flex justify-center items-center max-h-[400px]">
                <img
                  src={post.imageUrl}
                  alt="첨부 이미지"
                  className="max-h-[400px] w-auto object-contain rounded-xl shadow-3xs"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <p id="detail-post-description" className="text-neutral-700 text-sm whitespace-pre-wrap leading-relaxed bg-white border border-neutral-100 rounded-xl p-4 min-h-[100px] shadow-2xs">
              {post.description}
            </p>
          </div>

          {/* Render Tag Badges */}
          <div className="mb-8 notranslate" translate="no">
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-bold bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full notranslate" translate="no">
                  <Tag className="w-3 h-3" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Author Authority Panel (수정/해결/삭제) */}
          {isAuthor && (
            <div id="author-control-panel" className="mb-8 p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>
                  {activeUser?.isAdmin
                    ? '시스템 관리자 권한으로 이 게시글의 해결 완료 처리 및 삭제 권한을 가집니다.'
                    : '내가 작성한 게시글입니다. 이 글의 수거 완료 처리 및 관리가 가능합니다.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-toggle-resolved"
                  onClick={handleToggleResolved}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    post.resolved
                      ? 'bg-neutral-800 hover:bg-neutral-900 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {post.resolved ? '진행중 상태로 변경' : '해결 완료 처리'}
                </button>
                <button
                  type="button"
                  id="btn-delete-post"
                  onClick={handleDeletePost}
                  className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제하기
                </button>
              </div>
            </div>
          )}

          {/* Non-author Interaction Panel (신고하기) */}
          {!isAuthor && (
            <div id="user-report-panel" className="mb-8 p-4 bg-rose-50/50 rounded-xl border border-rose-100/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-rose-800 font-semibold">
                <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>이 게시글에 허위 정보, 욕설, 혹은 부적절한 콘텐츠가 포함되어 있나요?</span>
              </div>
              <button
                type="button"
                id="btn-report-post"
                onClick={() => triggerReport('post', post.id, post.title)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                🚨 게시글 신고하기
              </button>
            </div>
          )}

          {/* 🔍 Related Matches Widget */}
          <div id="related-matches-widget" className="mb-8 p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100/50 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              실시간 연관 {post.type === 'lost' ? '습득물(found)' : '분실물(lost)'} 매칭 제안
            </h3>
            
            {relatedMatches.length === 0 ? (
              <p className="text-xs text-slate-500">현재 이 게시글과 일치하는 유사한 반대 유형의 게시글이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedMatches.map(({ post: matchedPost, similarity, reason }) => (
                  <div 
                    key={matchedPost.id}
                    onClick={() => onSelectPost?.(matchedPost)}
                    className="bg-white p-3.5 rounded-xl border border-indigo-100 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {matchedPost.title}
                        </span>
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md shrink-0">
                          {Math.round(similarity * 100)}% 일치
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2">
                        {matchedPost.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-50 pt-1.5">
                      <span>📍 {matchedPost.location}</span>
                      <span className="text-indigo-600 font-bold">{reason.split(',')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div id="comments-section" className="border-t border-neutral-100 pt-8">
            <h3 className="text-base font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              댓글 피드 
              <span className="bg-neutral-100 text-neutral-600 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {comments.length}
              </span>
            </h3>

            {/* Comment list thread */}
            <div className="space-y-4 mb-8">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs border border-dashed border-neutral-100 rounded-2xl">
                  등록된 댓글이 아직 없습니다. 첫 댓글을 달며 소통을 유도해보세요!
                </div>
              ) : (
                comments.map((comment, index) => {
                  const isCommentAuthor = activeUser && comment.authorId === activeUser.id;
                  const isPostAuthor = activeUser && post.authorId === activeUser.id;
                  
                  return (
                    <div
                      key={comment.id}
                      id={`comment-item-${index}`}
                      className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 text-sm leading-relaxed"
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Meta header author info */}
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-800">{comment.authorName}</span>
                          <span className="font-mono text-[10px] text-neutral-400 px-1.5 py-0.5 bg-white border border-neutral-100 rounded-sm">
                            {comment.authorStudentId}
                          </span>
                          
                          {/* If the commenter is the post's author */}
                          {comment.authorId === post.authorId && (
                            <span className="text-[9px] font-bold bg-neutral-900 text-white px-2 py-0.5 rounded-full">
                              작성자
                            </span>
                          )}
                        </div>

                        {/* Date & deletion */}
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          <span className="font-mono">
                            {new Date(comment.createdAt).toLocaleString('ko-KR', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => triggerReport('comment', comment.id, comment.content)}
                            className="text-neutral-400 hover:text-rose-500 p-1 rounded-md transition-all cursor-pointer"
                            title="부적절한 댓글 신고"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
                          </button>
                          
                          {(isCommentAuthor || isPostAuthor || activeUser?.isAdmin) && (
                            <button
                              type="button"
                              id={`delete-comment-${comment.id}`}
                              onClick={() => handleDeleteCommentItem(comment.id)}
                              className="text-neutral-400 hover:text-rose-600 p-1 rounded-sm transition-all cursor-pointer"
                              title="댓글 삭제"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content text */}
                      <p className="text-neutral-700 leading-relaxed break-all whitespace-pre-wrap pl-1">
                        {comment.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form Section */}
            <form onSubmit={handleCreateComment} className="bg-neutral-50/60 p-4 rounded-xl border border-neutral-100">
              <span className="block text-xs font-bold text-neutral-500 mb-3 uppercase tracking-wide">
                새 상호소통 댓글 쓰기
              </span>

              {/* Guest details if user is NOT logged in */}
              {!activeUser && (
                <div className="bg-white p-3 rounded-xl border border-neutral-200/80 mb-4 space-y-3 shadow-2xs">
                  <div className="flex gap-2 text-xs text-amber-800 leading-normal mb-1">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>현재 비로그인 게스트 상태입니다. 성명과 학번을 작성하시면 즉시 소통이 가능합니다! 임의의 명칭도 환영합니다.</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="이름 (예: 김익명)"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="학번 (예: 202510100)"
                        value={guestStudentId}
                        onChange={(e) => setGuestStudentId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Text Input Row */}
              <div className="flex items-start gap-2">
                <textarea
                  id="textarea-new-comment"
                  rows={2}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="상호 양방향 소통을 위해 예의를 지켜 피드백 댓글을 달아주세요. (예: 분실물 수거 완료 여부, 추가 제보 등)"
                  className="grow bg-white border border-neutral-200 rounded-xl py-2.5 px-3.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all resize-none"
                />
                <button
                  type="submit"
                  id="submit-comment-btn"
                  className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3 px-5 rounded-xl text-xs shrink-0 self-stretch hover:shadow-xs transition-all cursor-pointer flex items-center justify-center align-middle"
                >
                  등록
                </button>
              </div>

              {errorText && (
                <p className="text-rose-600 text-xs font-semibold mt-2.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorText}
                </p>
              )}
            </form>

          </div>

        </div>
      </div>

      {/* Custom Sleek Confirmation Dialog for Post Deletion */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            {/* Modal Box */}
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
                <h3 className="text-lg font-bold text-slate-900">게시글을 정말 삭제할까요?</h3>
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                이 게시글을 정말로 삭제하시겠습니까? 삭제 시 게시글에 종속된 모든 상호작용 댓글도 함께 복구 불가능하게 영구 폐기됩니다.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePost}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  삭제 확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Sleek Confirmation Dialog for Comment Deletion */}
      <AnimatePresence>
        {commentToDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommentToDeleteId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full border border-slate-100 shadow-xl relative z-10 space-y-6 text-slate-850"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <X className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">댓글을 삭제하시겠습니까?</h3>
              </div>
              
              <p className="text-slate-500 text-xs leading-relaxed">
                작성하신 상호소통 댓글을 완전히 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCommentToDeleteId(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteComment}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  댓글 삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comprehensive Reports Form Overlay */}
      <AnimatePresence>
        {showReportDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!reportResultMsg) setShowReportDialog(false); }}
              className="absolute inset-0 bg-slate-900/65 backdrop-blur-xs"
            />
            
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-100 shadow-2xl relative z-10 space-y-5 text-slate-850"
            >
              <div className="flex items-center gap-2.5 text-rose-600 pb-2 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">부적절한 교내 콘텐츠 신고</h3>
                  <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">지성인 진광 학우들이 이용하는 안전한 생태계</p>
                </div>
              </div>

              {reportResultMsg ? (
                <div className="py-6 text-center space-y-3">
                  <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                    reportResultMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {reportResultMsg.type === 'success' ? <Check className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>
                  <p className="text-xs font-bold text-slate-800 shrink-0 leading-relaxed max-w-xs mx-auto">
                    {reportResultMsg.text}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendReport} className="space-y-4 text-xs font-medium text-slate-700">
                  <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">신고 대상 분류</p>
                    <p className="text-xs font-bold text-slate-800">
                      {reportTargetType === 'post' ? '게시글 신고' : '댓글 신고'}
                    </p>
                    <p className="text-[10px] text-slate-400 italic line-clamp-1 mt-1 font-mono">
                      원문 요지: "{reportTargetContent}"
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">신고 사유 항목 선택</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        '상업적 광고 / 도배 행위',
                        '스팸 / 허위 사실 유포',
                        '욕설 / 개인 명예 비방 / 언어폭력',
                        '개인정보 수집 및 불법 유출 우려',
                        '기타 (직접 작성)'
                      ].map((reasonOption) => (
                        <label
                          key={reasonOption}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            reportReason === reasonOption
                              ? 'bg-rose-50/50 border-rose-200 text-rose-900 font-bold'
                              : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name="report-reason"
                            value={reasonOption}
                            checked={reportReason === reasonOption}
                            onChange={() => setReportReason(reasonOption)}
                            className="text-rose-600 focus:ring-rose-500"
                          />
                          <span>{reasonOption}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {reportReason === '기타 (직접 작성)' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 block">기타 상세 사유</label>
                      <textarea
                        required
                        rows={3}
                        value={reportCustomReason}
                        onChange={(e) => setReportCustomReason(e.target.value)}
                        placeholder="상세한 신고 대상 사유를 구체적으로 적어 원활한 삭제 검토에 기여해 주세요."
                        className="w-full border border-slate-200 p-2.5 rounded-xl placeholder:text-slate-350 focus:outline-hidden focus:ring-2 focus:ring-rose-500/10 focus:border-rose-400 text-xs text-slate-800 resize-none font-medium"
                      />
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowReportDialog(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl text-xs font-semibold text-slate-600 transition-all cursor-pointer"
                    >
                      돌아가기 (닫기)
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer"
                    >
                      신고서 접수 제출
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
