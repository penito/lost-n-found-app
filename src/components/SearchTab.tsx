import React, { useState, useMemo } from 'react';
import { Post, CATEGORY_TAGS } from '../types';
import { incrementViews } from '../db';
import { Search, ArrowUpDown, Filter, Tag, MapPin, Calendar, Eye, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchTabProps {
  posts: Post[];
  loading: boolean;
  error: string | null;
  onSelectPost: (post: Post) => void;
  onPostUpdated: () => void;
  onRefreshPosts?: () => void;
}

/**
 * SearchTab Component - Provides highly refined simultaneous multi-condition searches 
 * and multi-tag filtering across student loss & found reports.
 */
export default function SearchTab({ 
  posts, 
  loading, 
  error, 
  onSelectPost, 
  onPostUpdated, 
  onRefreshPosts 
}: SearchTabProps) {
  // --- STATE DECLARATIONS ---
  
  // General query (matches across all fields)
  const [searchQuery, setSearchQuery] = useState('');
  
  // Advanced specific simultaneous search queries
  const [searchTitle, setSearchTitle] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searchReporter, setSearchReporter] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  
  // Tag multi-selection array state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Interactive control states
  const [selectedType, setSelectedType] = useState<'all' | 'found' | 'lost'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'views'>('time');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved'>('all');
  
  // Toggle advanced multi-condition panel
  const [showAdvanced, setShowAdvanced] = useState(false);

  // --- ACTIONS & UTILS ---

  /**
   * Safely registers view telemetry with the database server upon clicking any post card,
   * then updates the global posts cache and opens the details popup.
   * 
   * @param post Target post report model
   */
  const handleCardClick = async (post: Post) => {
    try {
      await incrementViews(post.id);
      onPostUpdated(); // Pull fresh database updates back to the App core state
      onSelectPost(post);
    } catch (e) {
      onSelectPost(post);
    }
  };

  /**
   * Toggles a tag inclusion inside the dynamic `selectedTags` multi-selection array.
   * 
   * @param tag Target category tag string
   */
  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  /**
   * Fully resets all search text inputs, multi-toggled tags, and status dropdowns.
   */
  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchTitle('');
    setSearchDescription('');
    setSearchReporter('');
    setSearchLocation('');
    setSelectedTags([]);
    setSelectedType('all');
    setSortBy('time');
    setStatusFilter('all');
  };

  // --- DERIVED COMPUTATION (SIMULTANEOUS MULTI-CRITERIA) ---

  const filteredAndSortedPosts = useMemo(() => {
    let result = [...posts];

    // 1. General search bar check (matches any field fallback)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(post => 
        post.title.toLowerCase().includes(q) ||
        post.description.toLowerCase().includes(q) ||
        post.location.toLowerCase().includes(q) ||
        post.reporterName.toLowerCase().includes(q) ||
        post.reporterStudentId.includes(q)
      );
    }

    // 2. Specific 제목 검색 (Title match check)
    if (searchTitle.trim()) {
      const q = searchTitle.toLowerCase().trim();
      result = result.filter(post => post.title.toLowerCase().includes(q));
    }

    // 3. Specific 내용 검색 (Detailed Description match check)
    if (searchDescription.trim()) {
      const q = searchDescription.toLowerCase().trim();
      result = result.filter(post => post.description.toLowerCase().includes(q));
    }

    // 4. Specific 작성자 검색 (Writer name or Student id match check)
    if (searchReporter.trim()) {
      const q = searchReporter.toLowerCase().trim();
      result = result.filter(post => 
        post.reporterName.toLowerCase().includes(q) ||
        post.reporterStudentId.includes(q)
      );
    }

    // 5. Specific 분실/습득 위치 검색 (Location match check)
    if (searchLocation.trim()) {
      const q = searchLocation.toLowerCase().trim();
      result = result.filter(post => post.location.toLowerCase().includes(q));
    }

    // 6. 다중 태그 동시 검색 (Multi-tag matching check)
    // If any tags are selected, matches elements that contain at least one of the selected tags (OR condition)
    if (selectedTags.length > 0) {
      result = result.filter(post => post.tags.some(t => selectedTags.includes(t)));
    }

    // 7. Post Type Filter: found vs lost vs all
    if (selectedType !== 'all') {
      result = result.filter(post => post.type === selectedType);
    }

    // 8. Resolution Status: unresolved items only
    if (statusFilter === 'unresolved') {
      result = result.filter(post => !post.resolved);
    }

    // 9. Sorting computation: newest-first (time) or most viewed-first (views)
    if (sortBy === 'time') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'views') {
      result.sort((a, b) => b.views - a.views);
    }

    return result;
  }, [
    posts, 
    searchQuery, 
    searchTitle, 
    searchDescription, 
    searchReporter, 
    searchLocation, 
    selectedTags, 
    selectedType, 
    sortBy, 
    statusFilter
  ]);

  // --- RENDER LAYOUT ---

  return (
    <div id="search-tab-root" className="grid grid-cols-1 lg:grid-cols-4 gap-6 py-4 px-1">
      
      {/* 1. LEFT SIDEBAR: Standard filters and sorting */}
      <div className="lg:col-span-1 order-2 lg:order-1 space-y-6">
        
        {/* Compact Filter Console Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-indigo-600" />
              세부 필터 조건
            </h3>
            <button
              onClick={handleResetFilters}
              className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 font-mono flex items-center gap-1 cursor-pointer"
              title="조건 초기화"
            >
              <RefreshCw className="w-3 h-3" />
              전체 초기화
            </button>
          </div>

          {/* A. Status filters toggle */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              해결 여부 상태
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                전체보기
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unresolved')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'unresolved'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                미해결만
              </button>
            </div>
          </div>

          {/* B. Sort controls */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
              정렬 적용
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button
                type="button"
                id="btn-sort-time"
                onClick={() => setSortBy('time')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  sortBy === 'time'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                최신순
              </button>
              <button
                type="button"
                id="btn-sort-views"
                onClick={() => setSortBy('views')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  sortBy === 'views'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                인기순
              </button>
            </div>
          </div>

          {/* C. Multiple Tag Selection Panel */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                카테고리 태그 (다중 선택)
              </label>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[10px] text-indigo-600 hover:underline font-bold transition-all cursor-pointer"
                >
                  선택 해제
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 notranslate" id="tag-multiselect-container" translate="no">
              {CATEGORY_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    translate="no"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer notranslate ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>#{tag}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              * 태그를 여러 개 선택하시면 해당 태그 중 하나라도 포함된 게시글들이 검색 결과에 함께 나타납니다.
            </p>
          </div>

        </div>

      </div>

      {/* 2. RIGHT SECTION: Interactive search inputs bar, Advanced filters grid, post feeds list */}
      <div className="lg:col-span-3 order-1 lg:order-2 space-y-4">
        
        {/* General Universal Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-4 text-indigo-500 w-5 h-5 animate-pulse" />
          <input
            id="search-input-box"
            type="text"
            placeholder="통합 검색 (제목, 설명 내용, 작성자 학번, 습득 장소 등을 전체 검색)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 bg-white rounded-2xl border border-slate-200 text-sm text-slate-850 placeholder-slate-400 shadow-xs focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-semibold"
          />
        </div>

        {/* Dynamic Expandable Multi-Condition Simultaneous search trigger */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs transition-all">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-slate-700 hover:text-indigo-600 transition-all text-xs font-bold cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-indigo-500" />
              상세 항목별 동시 검색 조건 (여러 조건을 함께 만족하는 결과 찾기)
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Core Simultaneous Search inputs grid */}
          {showAdvanced && (
            <div id="advanced-search-fields-deck" className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 mt-3 border-t border-slate-100">
              
              {/* Box 1. 제목 검색 */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  제목으로 검색
                </label>
                <input
                  type="text"
                  placeholder="예: 애플펜슬, 지갑"
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 shadow-3xs focus:outline-hidden focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Box 2. 내용 검색 */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  설명 내용으로 검색
                </label>
                <input
                  type="text"
                  placeholder="예: 실리콘 케이스, 토스카드"
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 shadow-3xs focus:outline-hidden focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Box 3. 작성자 검색 */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  작성자 이름 및 학번으로 검색
                </label>
                <input
                  type="text"
                  placeholder="예: 이서연, 20241"
                  value={searchReporter}
                  onChange={(e) => setSearchReporter(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 shadow-3xs focus:outline-hidden focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Box 4. 분실 위치 검색 */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  분실 및 습득 장소로 검색
                </label>
                <input
                  type="text"
                  placeholder="예: 인문관, 도서관 2층"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 shadow-3xs focus:outline-hidden focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>

            </div>
          )}
        </div>

        {/* Post Type segment selectors: ALL | FOUND | LOST */}
        <div className="flex items-center justify-between border border-slate-100 bg-white rounded-2xl p-1 shadow-3xs">
          <div className="flex items-center gap-1 w-full text-center">
            <button
              onClick={() => setSelectedType('all')}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              전체 목록 ({filteredAndSortedPosts.length})
            </button>
            <button
              onClick={() => setSelectedType('found')}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                selectedType === 'found'
                  ? 'bg-indigo-600 text-white shadow-3xs'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              습득물 (주운 것)
            </button>
            <button
              onClick={() => setSelectedType('lost')}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                selectedType === 'lost'
                  ? 'bg-rose-600 text-white shadow-3xs'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-850'
              }`}
            >
              분실물 (잃어버린 것)
            </button>
          </div>
        </div>

        {/* Scrollable Feed List containing all matching elements */}
        <div
          id="search-scroll-viewport"
          className="max-h-[700px] overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-200"
          style={{ scrollBehavior: 'smooth' }}
        >
          {loading ? (
            <div className="text-center py-24 bg-white border border-slate-100 rounded-3xl space-y-4 shadow-3xs flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-indigo-650 animate-spin" />
              <div className="space-y-1">
                <p className="text-slate-700 text-sm font-bold">학수고대 분실물 목록을 로딩하는 중입니다...</p>
                <p className="text-slate-400 text-xs font-medium">Supabase 실시간 분실물 데이터베이스와 교신하고 있습니다.</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-rose-50/50 border border-rose-100 rounded-3xl space-y-4 px-4 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-rose-105 bg-rose-100 flex items-center justify-center text-rose-650">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-rose-900 text-sm font-bold">정보 조회 실패</p>
                <p className="text-rose-700 text-xs leading-relaxed max-w-md mx-auto">{error}</p>
              </div>
              {onRefreshPosts && (
                <button
                  type="button"
                  onClick={onRefreshPosts}
                  className="mt-2 text-xs font-bold bg-rose-600 text-white px-4 py-2.5 rounded-full hover:bg-rose-700 transition-all cursor-pointer shadow-3xs border-none"
                >
                  새로고침 다시 시도하기
                </button>
              )}
            </div>
          ) : filteredAndSortedPosts.length === 0 ? (
            <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
              <p className="text-slate-500 text-sm font-semibold">설정하신 동시 만족 조건에 부합하는 분실물이 없습니다.</p>
              <p className="text-slate-400 text-xs">상세 검색 박스의 문구들을 지우거나 다른 검색어를 조합해 보세요.</p>
              <button
                onClick={handleResetFilters}
                className="mt-2 text-xs font-bold bg-indigo-600 text-white px-4 py-2.5 rounded-full hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
              >
                전체 조건 초기화하기
              </button>
            </div>
          ) : (
            filteredAndSortedPosts.map((post, index) => (
              <div
                key={post.id}
                id={`search-post-card-${index}`}
                onClick={() => handleCardClick(post)}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl shadow-3xs hover:shadow-xs transition-all duration-200 p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 cursor-pointer relative overflow-hidden group"
              >
                {/* Visual Accent boundary */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${post.type === 'found' ? 'bg-indigo-650' : 'bg-rose-600'}`} />

                <div className="pl-2 flex-1 min-w-0 flex gap-4 justify-between items-start">
                  <div className="space-y-2 flex-1 min-w-0">
                    
                    {/* Category Status & Time pill indicators */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold shadow-3xs">
                      
                      <span className={`px-2 py-0.5 rounded-md ${
                        post.type === 'found' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {post.type === 'found' ? '습득물' : '분실물'}
                      </span>

                      <span className={`px-2 py-0.5 rounded-md ${
                        post.resolved ? 'bg-slate-900 text-white border border-slate-800' : 'bg-amber-50 text-amber-800 border border-amber-100'
                      }`}>
                        {post.resolved ? '해결 완료' : '진행 중'}
                      </span>

                      <span className="text-slate-400 font-mono flex items-center gap-1 font-normal ml-1">
                        <Calendar className="w-3 h-3 text-slate-350" />
                        {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>

                    </div>

                    {/* Title of Lost Item */}
                    <h4 className="text-sm md:text-base font-bold text-slate-800 group-hover:text-indigo-600 group-hover:underline decoration-indigo-200 underline-offset-4 transition-all line-clamp-1 pt-1">
                      {post.title}
                    </h4>

                    {/* Extract brief description */}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                      {post.description}
                    </p>

                    {/* Bottom geographical markers */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-dashed border-slate-100 mt-2 text-xs">
                      <span className="text-slate-650 font-bold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                        {post.location}
                      </span>
                      <span className="text-slate-400 text-[10px] font-mono">
                        작성 학우: {post.reporterName} ({post.reporterStudentId})
                      </span>
                    </div>

                  </div>

                  {post.imageUrl && (
                    <div className="shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-slate-150 border border-slate-200 shadow-3xs self-center">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>

                {/* Right widgets column */}
                <div className="shrink-0 flex md:flex-col items-start md:items-end justify-between md:justify-start gap-2.5 pt-3 md:pt-0 pl-2 md:pl-0 border-t md:border-t-0 border-slate-50">
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full select-none">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-3 font-mono md:mt-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    <span className="flex items-center gap-1" title="조회수">
                      <Eye className="w-4 h-4 text-slate-400" />
                      {post.views}
                    </span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
