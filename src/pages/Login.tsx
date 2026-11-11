import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  X, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Fingerprint,
  Key,
  Loader2
} from "lucide-react";

// Types for WebAuthn
interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  type: "public-key";
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
}

interface PasskeyOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  authenticatorSelection: {
    authenticatorAttachment: "platform" | "cross-platform";
    userVerification: "required" | "preferred" | "discouraged";
    requireResidentKey: boolean;
  };
  timeout: number;
  attestation: "direct" | "indirect" | "none";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setConfirmationEmail(null);
    setShowConfirmation(false);
    setResendSent(false);
    setResendError(null);

    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        const { error: authError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: new URL("/auth/callback", window.location.origin).href,
          },
        });
        if (authError) throw authError;
        
        setSignupSuccess(true);
        setConfirmationEmail(email);
        setShowConfirmation(true);
        setTimeout(() => setSignupSuccess(false), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      if (mode !== "signup") {
        setConfirmationEmail(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendSent(false);
    setResendError(null);
    
    if (!confirmationEmail) return;
    
    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email: confirmationEmail,
        options: {
          emailRedirectTo: new URL("/auth/callback", window.location.origin).href,
        },
      });
      
      if (resendError) throw resendError;
      
      setResendSent(true);
      setTimeout(() => setResendSent(false), 5000);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend confirmation email");
      setTimeout(() => setResendError(null), 5000);
    }
  };

  // Passkey Registration (Signup)
  const handlePasskeySignup = useCallback(async () => {
    if (!email) {
      setPasskeyError("Please enter your email first");
      return;
    }

    setPasskeyLoading(true);
    setPasskeyError(null);
    setError(null);

    try {
      // Step 1: Get challenge from Supabase
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.enroll({
        factorType: "passkey",
        friendlyName: email,
      });

      if (challengeError) throw challengeError;

      // Step 2: Create credential using WebAuthn
      const publicKeyCredential = await navigator.credentials.create({
        publicKey: {
          challenge: base64ToArrayBuffer(challengeData.challenge),
          rp: { name: "Rain", id: window.location.hostname },
          user: {
            id: base64ToArrayBuffer(challengeData.user_id),
            name: email,
            displayName: email,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            requireResidentKey: true,
          },
          timeout: 60000,
          attestation: "direct",
        } as CredentialCreationOptions,
      }) as PasskeyCredential;

      if (!publicKeyCredential) {
        throw new Error("Failed to create passkey");
      }

      // Step 3: Verify the credential with Supabase
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: challengeData.factor_id,
        code: arrayBufferToBase64(publicKeyCredential.response.attestationObject),
        challenge: challengeData.challenge,
      });

      if (verifyError) throw verifyError;

      // Passkey registered successfully - now sign up the user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: "", // Empty password for passkey-only accounts
        options: {
          emailRedirectTo: new URL("/auth/callback", window.location.origin).href,
        },
      });

      if (signUpError) throw signUpError;

      setSignupSuccess(true);
      setConfirmationEmail(email);
      setShowConfirmation(true);
      setTimeout(() => setSignupSuccess(false), 5000);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Failed to create passkey");
    } finally {
      setPasskeyLoading(false);
    }
  }, [email]);

  // Passkey Authentication (Signin)
  const handlePasskeySignin = useCallback(async () => {
    if (!email) {
      setPasskeyError("Please enter your email first");
      return;
    }

    setPasskeyLoading(true);
    setPasskeyError(null);
    setError(null);

    try {
      // Step 1: Get challenge from Supabase
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorType: "passkey",
      });

      if (challengeError) throw challengeError;

      // Step 2: Get credential using WebAuthn
      const publicKeyCredential = await navigator.credentials.get({
        publicKey: {
          challenge: base64ToArrayBuffer(challengeData.challenge),
          allowCredentials: [{
            id: base64ToArrayBuffer(challengeData.credential_id),
            type: "public-key",
          }],
          userVerification: "required",
          timeout: 60000,
        } as CredentialRequestOptions,
      }) as PasskeyCredential;

      if (!publicKeyCredential) {
        throw new Error("Failed to get passkey");
      }

      // Step 3: Verify the credential with Supabase
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: challengeData.factor_id,
        code: arrayBufferToBase64(publicKeyCredential.response.authenticatorData),
        challenge: challengeData.challenge,
      });

      if (verifyError) throw verifyError;

      // Step 4: Sign in with the verified factor
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: "", // Empty password for passkey
      });

      if (signInError) throw signInError;
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Failed to sign in with passkey");
    } finally {
      setPasskeyLoading(false);
    }
  }, [email]);

  // Check if passkeys are supported
  const isPasskeySupported = useCallback(() => {
    return (
      typeof window !== "undefined" &&
      "credentials" in navigator &&
      "create" in navigator.credentials &&
      "get" in navigator.credentials &&
      window.isSecureContext
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#101114] text-[#f2f3f5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141b7b]">
            <Mail size={28} className="text-white" />
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.6px]">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-[13px] text-[#a0a3aa]">
            {mode === "signin"
              ? "Sign in to your Rain dashboard"
              : "Sign up to start your Rain dashboard"}
          </p>
        </div>

        <div className="rounded-[22px] border border-[#303238] bg-[#1c1e22] p-6 shadow-xl">
          {showConfirmation && confirmationEmail && (
            <div className="mb-5 rounded-lg bg-[#e6f7f0] border border-[#5b8c5a] px-4 py-3 text-[13px] text-[#276749]">
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 text-[#10b981] flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Check your email</p>
                  <p>
                    We've sent a confirmation link to <span className="font-semibold">{confirmationEmail}</span>. Please click the link to verify your email address.
                  </p>
                </div>
              </div>
              {resendSent ? (
                <p className="mt-2 text-[12px] text-[#8f94cb]">
                  Confirmation email resent successfully!
                </p>
              ) : (
                <button
                  onClick={handleResendConfirmation}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#1e293b] px-4 py-2 text-[12px] font-medium text-[#c3c8ff] hover:bg-[#252d93] transition"
                >
                  <RefreshCw size={16} className="text-[#141b7b]" />
                  Resend confirmation email
                </button>
              )}
            </div>
          )}

          {signupSuccess && !showConfirmation && (
            <div className="mb-5 rounded-lg bg-[#e6f7f0] border border-[#5b8c5a] px-4 py-3 text-[13px] text-[#276749]">
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 text-[#10b981] flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Almost there!</p>
                  <p>
                    A confirmation link has been sent to <span className="font-semibold">{confirmationEmail}</span>. Please check your email and click the link to verify your account.
                  </p>
                </div>
              </div>
              {resendSent ? (
                <p className="mt-2 text-[12px] text-[#8f94cb]">
                  Confirmation email resent successfully!
                </p>
              ) : (
                <button
                  onClick={handleResendConfirmation}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#1e293b] px-4 py-2 text-[12px] font-medium text-[#c3c8ff] hover:bg-[#252d93] transition"
                >
                  <RefreshCw size={16} className="text-[#141b7b]" />
                  Resend confirmation email
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#c3c5cb] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a0a3aa]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-11 w-full rounded-xl border border-[#383a40] bg-[#151619] pl-10 pr-3.5 text-[13px] text-[#f2f3f5] outline-none transition focus:border-[#141b7b] focus:ring-2 focus:ring-[#141b7b]/20 placeholder:text-[#858991]"
                />
              </div>
            </div>

            {mode === "signin" && (
              <div>
                <label className="block text-[11px] font-semibold text-[#c3c5cb] mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a0a3aa]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-11 w-full rounded-xl border border-[#383a40] bg-[#151619] pl-10 pr-3.5 text-[13px] text-[#f2f3f5] outline-none transition focus:border-[#8f94cb] focus:ring-2 focus:ring-[#141b7b]/20 placeholder:text-[#858991]"
                  />
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-[11px] font-semibold text-[#c3c5cb] mb-2">
                  Password (optional with passkey)
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a0a3aa]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••• (optional)"
                    className="h-11 w-full rounded-xl border border-[#383a40] bg-[#151619] pl-10 pr-3.5 text-[13px] text-[#f2f3f5] outline-none transition focus:border-[#8f94cb] focus:ring-2 focus:ring-[#141b7b]/20 placeholder:text-[#858991]"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-[#2a1d22] border border-[#5b2a35] px-3 py-2 text-[12px] text-[#e8a4b0]">
                {error}
              </div>
            )}

            {passkeyError && (
              <div className="rounded-lg bg-[#2a1d22] border border-[#5b2a35] px-3 py-2 text-[12px] text-[#e8a4b0]">
                {passkeyError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || passkeyLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#141b7b] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#252d93] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Loading...
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Sign up"
              )}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Passkey Section */}
          {isPasskeySupported() && (
            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#383a40]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#1c1e22] text-[#a0a3aa]">Or continue with</span>
                </div>
              </div>

              <div className="space-y-3">
                {mode === "signup" ? (
                  <button
                    type="button"
                    onClick={handlePasskeySignup}
                    disabled={passkeyLoading || !email}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#383a40] bg-[#151619] px-4 py-3 text-[13px] font-medium text-[#f2f3f5] transition hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passkeyLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Creating passkey...
                      </>
                    ) : (
                      <>
                        <Fingerprint size={18} className="text-[#141b7b]" />
                        Create account with Passkey
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasskeySignin}
                    disabled={passkeyLoading || !email}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#383a40] bg-[#151619] px-4 py-3 text-[13px] font-medium text-[#f2f3f5] transition hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passkeyLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Signing in with passkey...
                      </>
                    ) : (
                      <>
                        <Fingerprint size={18} className="text-[#141b7b]" />
                        Sign in with Passkey
                      </>
                    )}
                  </button>
                )}

                <p className="text-center text-[11px] text-[#6b6e75]">
                  Use Face ID, Touch ID, Windows Hello, or your security key
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setPasskeyError(null);
                setSignupSuccess(false);
                setConfirmationEmail(null);
                setShowConfirmation(false);
                setResendSent(false);
                setResendError(null);
              }}
              className="text-[12px] text-[#a0a3aa] hover:text-[#c3c8ff] transition"
            >
              {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#6b6e75]">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// Helper functions for base64/ArrayBuffer conversion
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}