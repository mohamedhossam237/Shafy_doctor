// /pages/login.js
'use client';
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Snackbar, Alert } from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';

export default function LoginPage() {
  const router = useRouter();
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const { emailLogin, signOut } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (message, severity = 'info') => setSnack({ open: true, message, severity });

  const toggleLang = () => {
    router.replace({ pathname: '/login', query: { lang: isArabic ? 'en' : 'ar' } }, undefined, { shallow: true });
  };

  // ---- role gate helpers ----
  const existsByUid = async (coll, uid) => {
    if (!uid) return { exists: false, data: null };
    const s = await getDoc(doc(db, coll, uid));
    return { exists: s.exists(), data: s.exists() ? s.data() : null };
  };
  const existsByEmail = async (coll, em) => {
    if (!em) return { exists: false, data: null };
    const qy = query(collection(db, coll), where('email', '==', em), limit(1));
    const s = await getDocs(qy);
    if (s.empty) return { exists: false, data: null };
    const d = s.docs[0];
    return { exists: true, data: d.data() };
  };

  const REQUIRE_EXCLUSIVE_ROLE = true;

  const isDoctorOnly = async (uid, emRaw) => {
    const em = (emRaw || '').toLowerCase();

    const [
      dUid, dEmail,
      pUid, pEmail,
      aUid, aEmail,
    ] = await Promise.all([
      existsByUid('doctors', uid), existsByEmail('doctors', em),
      existsByUid('patients', uid), existsByEmail('patients', em),
      existsByUid('assistants', uid), existsByEmail('assistants', em),
    ]);

    const doctorPresent = dUid.exists || dEmail.exists;
    const doctorData = dUid.data || dEmail.data || null;

    const patientPresent = pUid.exists || pEmail.exists;
    const assistantPresent = aUid.exists || aEmail.exists;

    if (!doctorPresent) {
      return {
        ok: false,
        reason: patientPresent ? 'patient' : assistantPresent ? 'assistant' : 'unknown',
        doctorData: null,
      };
    }
    if (REQUIRE_EXCLUSIVE_ROLE && (patientPresent || assistantPresent)) {
      return { ok: false, reason: patientPresent ? 'patient' : 'assistant', doctorData };
    }
    return { ok: true, reason: null, doctorData };
  };

  const signIn = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      const msg = isArabic ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Please fill all fields';
      setErrorMsg(msg);
      openSnack(msg, 'warning');
      return;
    }
    setLoading(true);
    try {
      const cred = await emailLogin(email.trim().toLowerCase(), password.trim());
      const uid = cred?.user?.uid;
      const em = cred?.user?.email || email.trim().toLowerCase();

      const gate = await isDoctorOnly(uid, em);
      if (!gate.ok) {
        await signOut().catch(() => {});
        const msg =
          gate.reason === 'patient'
            ? isArabic
              ? 'هذا الحساب مخصص للمريض، غير مسموح بالدخول هنا.'
              : 'This account is a patient account; access is not allowed here.'
            : gate.reason === 'assistant'
            ? isArabic
              ? 'هذا الحساب مخصص للمساعد، غير مسموح بالدخول هنا.'
              : 'This account is an assistant account; access is not allowed here.'
            : isArabic
            ? 'لا يوجد حساب طبيب مرتبط بهذه المعلومات.'
            : 'No doctor account found for these credentials.';
        setErrorMsg(msg);
        openSnack(msg, 'error');
        return;
      }

      const isProfileCompleted = gate.doctorData?.profileCompleted === true;
      router.replace({
        pathname: isProfileCompleted ? '/' : '/doctor/details',
        query: { lang: isArabic ? 'ar' : 'en' },
      });
    } catch (e2) {
      const code = e2?.code;
      let msg = isArabic ? 'فشل تسجيل الدخول' : 'Login failed';
      if (code === 'auth/invalid-email') msg = isArabic ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
      else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
        msg = isArabic ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password';
      else if (code === 'auth/wrong-password') msg = isArabic ? 'كلمة المرور غير صحيحة' : 'Incorrect password';
      else if (e2?.message) msg = `${isArabic ? 'فشل تسجيل الدخول' : 'Login failed'}: ${e2.message}`;
      setErrorMsg(msg);
      openSnack(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{isArabic ? 'تسجيل دخول الطبيب | شافي' : 'Doctor Sign In | Shafy Doctor'}</title>
      </Head>

      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 82% 16%, rgba(56, 189, 248, 0.34) 0%, transparent 42%), radial-gradient(circle at 14% 85%, rgba(99, 102, 241, 0.36) 0%, transparent 44%), linear-gradient(135deg, #09152e 0%, #15347a 48%, #2563eb 100%)',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle Architectural Dot Pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            opacity: 0.25,
            pointerEvents: 'none',
          }}
        />

        {/* Ambient Floating Orbs */}
        <div
          style={{
            position: 'absolute',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.24)',
            filter: 'blur(95px)',
            top: '-6%',
            right: '6%',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'rgba(14, 165, 233, 0.2)',
            filter: 'blur(85px)',
            bottom: '-4%',
            left: '6%',
            pointerEvents: 'none',
          }}
        />

        {/* Language Toggle Floating Pill */}
        <button
          type="button"
          onClick={toggleLang}
          style={{
            position: 'absolute',
            top: '22px',
            [isArabic ? 'left' : 'right']: '24px',
            zIndex: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.14)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.28)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <TranslateRoundedIcon sx={{ fontSize: 16 }} />
          <span>{isArabic ? 'English' : 'العربية'}</span>
        </button>

        {/* Centered Frosted Glass Auth Card */}
        <div
          className="glass-panel animate-fade-in"
          style={{
            width: '100%',
            maxWidth: '468px',
            background: 'rgba(255, 255, 255, 0.96)',
            borderRadius: '28px',
            padding: '38px 36px',
            boxShadow: '0 30px 64px -16px rgba(9, 21, 46, 0.48), inset 0 1px 0 rgba(255,255,255,0.9)',
            position: 'relative',
            zIndex: 10,
            textAlign: isArabic ? 'right' : 'left',
          }}
        >
          {/* Header Brand */}
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 14px',
                borderRadius: '22px',
                background: '#ffffff',
                border: '2px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 12px 28px -6px rgba(37, 99, 235, 0.34)',
              }}
            >
              <img
                src="/logo.png"
                alt="Shafy Doctor"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}
              />
            </div>

            <h1 style={{ fontSize: '1.52rem', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>
              {isArabic ? 'بوابة الطبيب الذكية' : 'Shafy Doctor Portal'}
            </h1>
            <p style={{ fontSize: '0.86rem', color: '#64748b', fontWeight: 600 }}>
              {isArabic
                ? 'منظومة شافي لإدارة العيادات والملفات الطبية'
                : 'Cloud clinic management & clinical intelligence suite'}
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '12px',
                padding: '5px 14px',
                borderRadius: '999px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '0.78rem',
                fontWeight: 800,
              }}
            >
              <VerifiedUserRoundedIcon sx={{ fontSize: 15 }} />
              <span>{isArabic ? 'دخول آمن لحسابات الأطباء المعتمدين' : 'Verified Physician Access Only'}</span>
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '12px 15px',
                borderRadius: '13px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.84rem',
                fontWeight: 700,
                marginBottom: '18px',
                lineHeight: 1.5,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={signIn}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">
                {isArabic ? 'البريد الإلكتروني للطبيب' : 'Doctor Email Address'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="doctor@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    [isArabic ? 'paddingLeft' : 'paddingRight']: '42px',
                  }}
                />
                <MailOutlineRoundedIcon
                  sx={{
                    fontSize: 19,
                    position: 'absolute',
                    [isArabic ? 'left' : 'right']: '13px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">
                {isArabic ? 'كلمة المرور' : 'Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    [isArabic ? 'paddingLeft' : 'paddingRight']: '42px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    [isArabic ? 'left' : 'right']: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <VisibilityOffRoundedIcon sx={{ fontSize: 19 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 19 }} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '22px' }}>
              <Link
                href={`/forgot-password${isArabic ? '?lang=ar' : '?lang=en'}`}
                style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2563eb', textDecoration: 'none' }}
              >
                {isArabic ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px 20px', fontSize: '0.98rem', borderRadius: '15px' }}
            >
              <LockOutlinedIcon sx={{ fontSize: 18 }} />
              <span>
                {loading
                  ? isArabic ? 'جارٍ التحقق من بيانات الطبيب...' : 'Signing in...'
                  : isArabic ? 'تسجيل الدخول إلى البوابة' : 'Sign In to Portal'}
              </span>
              {!loading && (
                <ArrowForwardRoundedIcon
                  sx={{ fontSize: 18, transform: isArabic ? 'rotate(180deg)' : 'none' }}
                />
              )}
            </button>
          </form>

          {/* Footer Branding */}
          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
            {isArabic
              ? `منظومة شافي الطبية © ${new Date().getFullYear()} • بوابة الطبيب السحابية`
              : `Shafy Medical © ${new Date().getFullYear()} • Cloud Doctor Portal`}
          </div>
        </div>

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
            {snack.message}
          </Alert>
        </Snackbar>
      </div>
    </>
  );
}
