import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock3 } from "lucide-react";

export default function AuthCallback() {
  const [status, setStatus] = useState("Processing authentication...");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Try to get session first (this may pick up tokens from URL automatically)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          setStatus("Authentication successful! Redirecting...");
          setTimeout(() => navigate("/", { replace: true }), 1000);
          return;
        }

        // If no session yet, try to extract tokens from URL hash or search
        let accessToken = "";
        let refreshToken = "";

        // Check hash first
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        accessToken = hashParams.get("access_token") || "";
        refreshToken = hashParams.get("refresh_token") || "";

        // Also check search params
        if (!accessToken) {
          const searchParams = new URLSearchParams(window.location.search);
          accessToken = searchParams.get("access_token") || "";
          refreshToken = searchParams.get("refresh_token") || "";
        }

        if (accessToken && refreshToken) {
          // Exchange code for session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;

          const { data: { session: newSession }, error: newSessionError } = await supabase.auth.getSession();
          if (newSessionError) throw newSessionError;

          if (newSession) {
            setStatus("Authentication successful! Redirecting...");
            setTimeout(() => navigate("/", { replace: true }), 1000);
          } else {
            setStatus("Authentication incomplete. Please try again.");
            setTimeout(() => navigate("/login", { replace: true }), 2000);
          }
        } else {
          // No tokens found, check if this is just a regular redirect
          setStatus("Authentication incomplete. Please try again.");
          setTimeout(() => navigate("/login", { replace: true }), 2000);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("An error occurred during authentication. Please try again.");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, location]);

  return (
    <div className="min-h-screen bg-[#101114] text-[#f2f3f5] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#141b7b]">
          <Clock3 size={24} className="text-white" />
        </div>
        <h2 className="text-[20px] font-bold tracking-[-.5px]">{status}</h2>
        <p className="mt-2 text-[13px] text-[#a0a3aa]">
          Please wait while we redirect you to your Rain dashboard.
        </p>
      </div>
    </div>
  );
}