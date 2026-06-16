import React, { useState, useEffect } from 'react';
import { addPost, getCurrentUser } from '../db';
import { CATEGORY_TAGS, PostType } from '../types';
import { PlusCircle, MapPin, User, Tag, FileText, Check, AlertCircle, HelpCircle, Image, Trash2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RegisterTabProps {
  onRegisterSuccess: () => void;
  activeUser: ReturnType<typeof getCurrentUser>;
}

export default function RegisterTab({ onRegisterSuccess, activeUser }: RegisterTabProps) {
  const [type, setType] = useState<PostType>('found');
  const [title, setTitle] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterStudentId, setReporterStudentId] = useState('');
  const [location, setLocation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  
  const [infoMessage, setInfoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // States for Image Upload
  const [imageUrl, setImageUrl] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setInfoMessage({ type: 'error', text: '이미지 파일만 등록 가능합니다.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setInfoMessage({ type: 'error', text: '이미지 파일의 크기는 10MB 이하여야 합니다.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Autofill if logged in
  useEffect(() => {
    if (activeUser) {
      setReporterName(activeUser.name);
      setReporterStudentId(activeUser.studentId);
    } else {
      setReporterName('');
      setReporterStudentId('');
    }
  }, [activeUser]);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      // Limit to 4 tags to keep rules/storage safe & compact
      if (selectedTags.length < 4) {
        setSelectedTags([...selectedTags, tag]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setInfoMessage({ type: 'error', text: '글 제목을 입력해 주세요.' });
      return;
    }
    if (!reporterName.trim()) {
      setInfoMessage({ type: 'error', text: '발견자 혹은 분실자의 이름을 입력해 주세요.' });
      return;
    }
    if (!reporterStudentId.trim()) {
      setInfoMessage({ type: 'error', text: '학번을 입력해 주세요.' });
      return;
    }
    if (!location.trim()) {
      setInfoMessage({ type: 'error', text: '발견 혹은 분실한 정확한 위치를 입력해 주세요.' });
      return;
    }
    if (selectedTags.length === 0) {
      setInfoMessage({ type: 'error', text: '분실물을 빠르게 찾을 수 있도록 태그를 1개 이상 선택해 주세요.' });
      return;
    }
    if (!description.trim()) {
      setInfoMessage({ type: 'error', text: '상세 설명(물품의 특징, 전달 위치 등)을 입력해 주세요.' });
      return;
    }

    try {
      await addPost({
        title: title.trim(),
        type,
        reporterName: reporterName.trim(),
        reporterStudentId: reporterStudentId.trim(),
        location: location.trim(),
        tags: selectedTags,
        description: description.trim(),
        authorId: activeUser ? activeUser.id : 'guest',
        imageUrl: imageUrl || undefined,
      });

      setInfoMessage({ type: 'success', text: '게시글이 성공적으로 등록되었습니다!' });
      
      // Reset layout counters
      setTitle('');
      setLocation('');
      setSelectedTags([]);
      setDescription('');
      setImageUrl('');
      if (!activeUser) {
        setReporterName('');
        setReporterStudentId('');
      }

      // Success callback
      setTimeout(() => {
        setInfoMessage(null);
        onRegisterSuccess();
      }, 1500);

    } catch (err) {
      setInfoMessage({ type: 'error', text: '등록 중 오류가 발생했습니다. 다시 시도해 주세요.' });
    }
  };

  return (
    <div id="register-tab-container" className="max-w-2xl mx-auto py-4 px-1">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
        
        {/* Tab Header Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-indigo-600" />
            분실물 및 습득물 등록하기
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            교내에서 주운 물건을 게시하거나, 잃어버린 소중한 물건의 탐색을 학우들에게 의뢰해 보세요.
          </p>
        </div>

        {/* Notice for Guest writing */}
        {!activeUser && (
          <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800 text-xs leading-relaxed">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold">잠깐! </span>
              현재 비로그인 게스트 상태로 글을 작성하고 있습니다. 글 작성이 가능하지만, 
              이후 <strong className="font-bold underline">내 정보 탭</strong>에서 간단한 회원가입 후 로그인하여 
              글을 쓰시면 내가 올린 분실글을 나중에 수정·삭제하거나 편리하게 관리할 수 있습니다.
            </div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Post Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">구분</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="btn-select-found"
                onClick={() => setType('found')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 border-2 ${
                  type === 'found'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                    : 'bg-slate-55 bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${type === 'found' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                습득물 (주웠어요)
              </button>

              <button
                type="button"
                id="btn-select-lost"
                onClick={() => setType('lost')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 border-2 ${
                  type === 'lost'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                    : 'bg-slate-55 bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${type === 'lost' ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
                분실물 (잃어버렸어요)
              </button>
            </div>
          </div>

          {/* Title Area */}
          <div>
            <label htmlFor="input-title" className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              글 제목
            </label>
            <input
              id="input-title"
              type="text"
              required
              placeholder={type === 'found' ? '예: 학생회관 3층 복도에서 크로스백 주웠습니다.' : '예: 인문관 주차장 근처에서 무선 이어폰 한 쪽 잃어버렸어요...'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm font-medium"
            />
          </div>

          {/* Reporter metadata row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Reporter Name */}
            <div>
              <label htmlFor="input-reporter-name" className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                {type === 'found' ? '발견자 성명' : '분실자 성명'}
              </label>
              <input
                id="input-reporter-name"
                type="text"
                required
                placeholder="성명을 입력해 주세요"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm font-medium"
              />
            </div>

            {/* Reporter Student ID */}
            <div>
              <label htmlFor="input-reporter-id" className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-500">ID</span>
                {type === 'found' ? '발견자 학번' : '분실자 학번'}
              </label>
              <input
                id="input-reporter-id"
                type="text"
                required
                placeholder="예: 202410123"
                value={reporterStudentId}
                onChange={(e) => setReporterStudentId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm font-medium"
              />
            </div>

          </div>

          {/* Found/Lost Location */}
          <div>
            <label htmlFor="input-location" className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              {type === 'found' ? '발견된 위치' : '분실된 위치'}
            </label>
            <input
              id="input-location"
              type="text"
              required
              placeholder="예: 중앙도서관 2층 대외학술라운지 소파 구석"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm font-medium"
            />
          </div>

          {/* Image Upload Area */}
          <div id="image-upload-wrapper">
            <label className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-400" />
              부착 이미지 첨부 <span className="text-xs text-slate-400 font-normal">(선택 사항)</span>
            </label>
            
            {imageUrl ? (
              <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-72 flex justify-center items-center">
                <img 
                  src={imageUrl} 
                  alt="첨부 이미지" 
                  className="max-h-72 w-auto object-contain rounded-2xl"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-3 right-3 p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center border-none"
                  title="이미지 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('image-file-input')?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 select-none ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/60'
                }`}
              >
                <input 
                  type="file" 
                  id="image-file-input" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <div className="p-3 bg-white rounded-full shadow-xs border border-slate-100 text-slate-400">
                  <Image className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-700">기기에 있는 사진 올리기 또는 드롭다운</p>
                  <p className="text-[11px] text-slate-400">JPG, PNG, GIF 등 지원 (최대 10MB)</p>
                </div>
              </div>
            )}
          </div>

          {/* Tags Selection Grid */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-slate-400" />
              카테고리 태그 선택 <span className="text-xs text-slate-400 font-normal">(중복 선택 가능, 최대 4개)</span>
            </label>
            <div className="flex flex-wrap gap-2 pt-1 font-sans">
              {CATEGORY_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    id={`tag-btn-${tag}`}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Description */}
          <div>
            <label htmlFor="input-description" className="block text-sm font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              상세 설명 및 회수 안내
            </label>
            <textarea
              id="input-description"
              required
              rows={4}
              placeholder="특징(색상, 제조사, 상태), 보관 상태(본인 보관, 학과 사무실, 안내 데스크 등)를 구체적으로 작성해주시면 빠르게 회수하는 데 큰 도움이 됩니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm resize-none font-medium"
            />
          </div>

          {/* Status message alerts */}
          <AnimatePresence mode="wait">
            {infoMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                id="registration-alert-box"
                className={`p-4 rounded-xl flex items-center gap-2.5 text-xs font-medium leading-normal ${
                  infoMessage.type === 'success'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {infoMessage.type === 'success' ? (
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{infoMessage.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Register Button */}
          <button
            type="submit"
            id="submit-post-btn"
            className="w-full bg-indigo-600 text-white font-semibold py-4 rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-indigo-100 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-indigo-100" />
            작성 완료 및 등록하기
          </button>

        </form>
      </div>
    </div>
  );
}
