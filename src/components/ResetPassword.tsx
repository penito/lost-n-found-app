import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResetPasswordProps {
  onSuccess: () => void;
}

export default function ResetPassword({ onSuccess }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidAccess, setIsValidAccess] = useState<boolean | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check if the user entered via an email reset link
    const hash = window.location.hash;
    const search = window.location.search;
    const hasRecoveryToken = 
      hash.includes('type=recovery') || 
      hash.includes('access_token=') || 
      search.includes('code=');

    if (hasRecoveryToken) {
      setIsValidAccess(true);
    } else {
      // Also check if there's an active recovery session in Supabase Auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsValidAccess(true);
        } else {
          setIsValidAccess(false);
          setAlert({
            type: 'error',
            text: '올바르지 않은 접근입니다. 이메일에 포함된 비밀번호 재설정 링크를 통해 접속해 주세요.'
          });
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!password || !confirmPassword) {
      setAlert({ type: 'error', text: '비밀번호를 입력해 주세요.' });
      return;
    }

    if (password.length < 6) {
      setAlert({ type: 'error', text: '비밀번호는 최소 6자리 이상이어야 합니다.' });
      return;
    }

    if (password !== confirmPassword) {
      setAlert({ type: 'error', text: '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setAlert({ type: 'error', text: error.message || '비밀번호 변경 중 오류가 발생했습니다.' });
      } else {
        setAlert({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다! 로그인 화면으로 이동합니다.' });
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      setAlert({ type: 'error', text: err.message || '서버와의 통신에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidAccess === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl max-w-md mx-auto shadow-sm">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 mt-4">비밀번호 재설정 권한을 검증하고 있습니다...</p>
      </div>
    );
  }

  if (isValidAccess === false) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm animate-pulse">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">비밀번호 변경 접근 권한 없음</h2>
            <p className="text-slate-500 text-xs leading-relaxed">
              이 페이지는 이메일의 비밀번호 재설정 링크를 클릭하여 진입한 경우에만 접근할 수 있습니다.
              보안 유지를 위해 직접 경로 주소를 입력하여 접속하는 행위는 차단됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.history.replaceState(null, '', '/');
              window.location.reload();
            }}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer border-none"
          >
            메인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Card Header */}
        <div className="bg-indigo-50/50 p-6 border-b border-slate-100 text-center">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-3xs">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-slate-800">새로운 비밀번호 설정</h2>
          <p className="text-[11px] text-slate-400 font-medium mt-1">계정의 안전을 위해 새로운 비밀번호를 설정해 주세요.</p>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {alert && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`p-3.5 mb-6 rounded-xl flex items-center gap-2.5 text-xs font-semibold border ${
                  alert.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {alert.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{alert.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Password input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                새 비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                <input
                  type="password"
                  required
                  placeholder="새 비밀번호를 입력해 주세요 (최소 6자)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Confirm password input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                새 비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-indigo-500" />
                <input
                  type="password"
                  required
                  placeholder="새 비밀번호를 한 번 더 입력해 주세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-md shadow-indigo-100 cursor-pointer mt-6 flex items-center justify-center gap-1.5 border-none"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
                  <span>비밀번호 변경 중...</span>
                </>
              ) : (
                '비밀번호 변경 완료'
              )}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
