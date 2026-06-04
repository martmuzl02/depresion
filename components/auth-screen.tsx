'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Facebook,
  Smartphone,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  signInWithProvider,
  signInWithPhone,
  verifyPhoneCode,
} from '@/lib/supabase';
import { COUNTRY_CODES, getDefaultCountryCode } from '@/lib/country-codes';
import { useOnlineStatus } from '@/hooks/use-online-status';

// Phone validation – accepts international format +CC-9-XXX-XXXX
const phoneRegex = /^[0-9]{6,15}$/;
function isValidPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  return phoneRegex.test(cleaned) && cleaned.length >= 6;
}

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const isOnline = useOnlineStatus();
  const [countryCode, setCountryCode] = useState(getDefaultCountryCode());
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [step, setStep] = useState<'choose' | 'phone' | 'verify'>('choose');
  const [loading, setLoading] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [phoneError, setPhoneError] = useState('');

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleProvider(provider: 'google' | 'facebook') {
    if (!isSupabaseConfigured) {
      setStatus('Supabase no está configurado. No se puede iniciar sesión con proveedor.');
      return;
    }
    setLoading(true);
    setStatus('Abriendo sesión...');
    const { error } = await signInWithProvider(provider, window.location.origin + '/auth/callback');
    setLoading(false);
    if (error) {
      setStatus(error.message ?? 'No se pudo iniciar sesión.');
      return;
    }
    setStatus('Redirigiéndote para completar el inicio de sesión...');
  }

  async function handleSendCode() {
    setPhoneError('');
    if (!isValidPhone(phone)) {
      setPhoneError('Ingresa un número válido (mínimo 6 dígitos)');
      setStatus('');
      return;
    }
    if (!isSupabaseConfigured) {
      setStatus('Supabase no está configurado. No se puede enviar SMS.');
      return;
    }
    if (!isOnline) {
      setStatus('Sin conexión. Verifica tu internet e intenta de nuevo.');
      return;
    }

    setLoading(true);
    setStatus('Enviando código...');
    const fullPhone = countryCode + phone.replace(/[\s\-()]/g, '');
    const { error } = await signInWithPhone(fullPhone);
    setLoading(false);

    if (error) {
      const errorMsg = error.message ?? 'No se pudo enviar el código.';
      setStatus(errorMsg);
      console.error('[OTP Send] Error:', error);
      return;
    }

    setStatus('Revisa tu teléfono. Llegará un código SMS en breve.');
    setStep('verify');
    setResendCount(0);
    setResendCooldown(30);
  }

  async function handleResendCode() {
    if (resendCount >= 3) {
      setStatus('Máximo de reenvíos alcanzado. Por favor intenta más tarde.');
      return;
    }
    setResendCooldown(30);
    setResendCount(resendCount + 1);
    await handleSendCode();
  }

  async function handleVerifyCode() {
    if (!code.trim() || code.trim().length < 4) {
      setStatus('Ingresa un código válido (mínimo 4 dígitos)');
      return;
    }

    setLoading(true);
    setStatus('Verificando código...');
    const fullPhone = countryCode + phone.replace(/[\s\-()]/g, '');
    const { error } = await verifyPhoneCode(fullPhone, code);
    setLoading(false);

    if (error) {
      const errorMsg = error.message ?? 'Código incorrecto. Intenta de nuevo.';
      setStatus(errorMsg);
      console.error('[OTP Verify] Error:', error);
      return;
    }

    setStatus('¡Listo! Has iniciado sesión.');
    onAuthenticated();
  }

  const canSendCode = isValidPhone(phone) && !loading;
  const canResend =
    step === 'verify' && resendCooldown === 0 && resendCount < 3 && !loading;

  return (
    <div className="flex flex-col h-full bg-[#0d0d12] px-6 py-8">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-red-400 text-xs">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Sin conexión. Algunos servicios no estarán disponibles.</span>
        </div>
      )}

      {/* Online Indicator */}
      {isOnline && (
        <div className="mb-3 flex items-center justify-center gap-1 text-green-400/60 text-xs">
          <Wifi className="w-3 h-3" />
          <span>Conectado</span>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className="text-center">
          <p className="text-white/40 text-xs uppercase tracking-[0.3em] mb-3">
            Bienvenido de nuevo
          </p>
          <h1 className="text-white text-3xl font-semibold">Inicia sesión</h1>
          <p className="text-white/40 text-sm mt-3 max-w-[320px] mx-auto leading-relaxed">
            Accede con tu cuenta social o con tu teléfono para que Yenny te conozca y la app se adapte a ti.
          </p>
        </div>

        <div className="grid gap-3">
          {/* Social providers */}
          <button
            onClick={() => handleProvider('google')}
            disabled={loading || !isOnline}
            className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-white/20 disabled:opacity-50"
          >
            <Globe className="w-4 h-4" />
            Iniciar con Google
          </button>
          <button
            onClick={() => handleProvider('facebook')}
            disabled={loading || !isOnline}
            className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white transition hover:border-white/20 disabled:opacity-50"
          >
            <Facebook className="w-4 h-4" />
            Iniciar con Facebook
          </button>
        </div>

        <div className="relative py-3">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          <div className="relative mx-auto w-fit bg-[#0d0d12] px-3 text-xs text-white/40">
            o con teléfono
          </div>
        </div>

        {step !== 'verify' ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="block text-white/50 text-xs mb-2">Número de teléfono</label>

              {/* Country Code + Phone Input */}
              <div className="flex gap-2">
                {/* Country Dropdown */}
                <div className="relative w-24">
                  <button
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-white/10 px-3 py-2.5 text-white text-sm hover:border-white/20 focus:outline-none focus:border-primary"
                  >
                    <span>{countryCode}</span>
                    <ChevronDown className="w-3 h-3 text-white/50" />
                  </button>

                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#131319] border border-white/10 rounded-lg max-h-48 overflow-y-auto z-10">
                      {COUNTRY_CODES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            setCountryCode(c.code);
                            setShowCountryDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition ${
                            countryCode === c.code
                              ? 'bg-primary/20 text-white'
                              : 'text-white/60 hover:bg-white/5'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number Input */}
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneError('');
                  }}
                  placeholder="9 11 1234 5678"
                  className="flex-1 rounded-lg border border-white/10 bg-white/10 px-3 py-2.5 text-white text-sm outline-none placeholder-white/40 focus:border-primary focus:bg-white/15 transition"
                />
              </div>

              {phoneError && <p className="text-red-400 text-xs mt-2">{phoneError}</p>}
              <p className="text-white/30 text-xs mt-2">
                Formato: {countryCode} + dígitos locales
              </p>
            </div>

            <button
              onClick={handleSendCode}
              disabled={!canSendCode}
              className="w-full rounded-2xl bg-primary text-black px-4 py-3 text-sm font-semibold transition hover:bg-primary/90 disabled:opacity-50"
            >
              Enviar código
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="block text-white/50 text-xs mb-2">Código SMS</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white text-sm outline-none placeholder-white/40 focus:border-primary focus:bg-white/15 transition"
              />
              <p className="text-white/30 text-xs mt-2">Código de 6 dígitos enviado por SMS</p>
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={loading || code.trim().length < 4}
              className="w-full rounded-2xl bg-primary text-black px-4 py-3 text-sm font-semibold transition hover:bg-primary/90 disabled:opacity-50"
            >
              Verificar código
            </button>

            {canResend ? (
              <button
                onClick={handleResendCode}
                className="w-full text-white/50 text-xs py-2 hover:text-white/70 transition"
              >
                📲 Reenviar código ({3 - resendCount} intentos restantes)
              </button>
            ) : resendCooldown > 0 ? (
              <p className="text-center text-white/30 text-xs py-2">
                Reenviar en {resendCooldown}s
              </p>
            ) : null}
          </div>
        )}

        {status && (
          <p
            className={`text-center text-sm ${
              status.includes('Error') || status.includes('incorrecto')
                ? 'text-red-400'
                : 'text-white/60'
            }`}
          >
            {status}
          </p>
        )}
      </div>

      <div className="space-y-3 text-center text-xs text-white/30">
        <p>
          Si no tienes cuenta, puedes crearla con Google, Facebook o tu teléfono.
        </p>
        {!isSupabaseConfigured && (
          <button
            onClick={onAuthenticated}
            className="mt-2 inline-flex items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Continuar sin cuenta
          </button>
        )}
      </div>
    </div>
  );
}
