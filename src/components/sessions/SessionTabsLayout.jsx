import { useState, useEffect } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useSupabaseAuth";
import { requireSupabase } from "../../lib/supabase";
import { Button, LoadingSpinner } from "../ui";
import NotFound from "../../routes/NotFound";
import { getGuestSessionBySlug } from "../../lib/guestData";

/**
 * SessionTabsLayout
 *
 * A persistent layout wrapper that renders the session header + nav tabs once,
 * keeping them alive across route changes between the three session sub-pages:
 *   - Workspace  (/campaigns/:slug/sessions/:slug)
 *   - Journal    (/campaigns/:slug/sessions/:slug/journal)
 *   - Preferences (/campaigns/:slug/sessions/:slug/preferences)
 *
 * Because this component never unmounts on tab switch, CSS `transition-all` on
 * the tab buttons can animate font-size, font-weight, and background smoothly.
 */
export default function SessionTabsLayout() {
  const { campaignSlug, sessionSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const { isGuest, isLoading: authLoading } = authState;

  const [campaignId, setCampaignId] = useState(null);
  const [campaignName, setCampaignName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [isNotFound, setIsNotFound] = useState(false);
  const [resolving, setResolving] = useState(true);

  // Determine active tab from pathname
  const pathname = location.pathname;
  const isJournal = pathname.endsWith("/journal");
  const isPreferences = pathname.endsWith("/preferences");
  const isActivity = pathname.endsWith("/activity");
  const isWorkspace = !isJournal && !isPreferences && !isActivity;

  useEffect(() => {
    if (authLoading) return;

    if (isGuest) {
      const userId = authState.user?.id;
      const guestRoute = userId
        ? getGuestSessionBySlug(userId, campaignSlug, sessionSlug)
        : null;
      if (guestRoute) {
        setCampaignId(guestRoute.campaign.id);
        setCampaignName(guestRoute.campaign.name);
        setSessionName(guestRoute.session.name || "Session");
      } else {
        setIsNotFound(true);
      }
      setResolving(false);
      return;
    }

    const resolveNames = async () => {
      try {
        const client = requireSupabase();

        // Step 1: resolve campaign by slug
        const { data: campaignData, error: campaignError } = await client
          .from("campaigns")
          .select("id, name")
          .eq("slug", campaignSlug)
          .single();

        if (campaignError || !campaignData) {
          setIsNotFound(true);
          return;
        }

        // Step 2: session lookup + membership check in parallel
        const [sessionResult, memberResult] = await Promise.all([
          client
            .from("sessions")
            .select("id, name")
            .eq("slug", sessionSlug)
            .eq("campaign_id", campaignData.id)
            .single(),
          client
            .from("campaign_members")
            .select("campaign_id")
            .eq("campaign_id", campaignData.id)
            .eq("user_id", authState.user.id)
            .maybeSingle(),
        ]);

        if (sessionResult.error || !sessionResult.data) {
          setIsNotFound(true);
          return;
        }

        if (memberResult.error || !memberResult.data) {
          setIsNotFound(true);
          return;
        }

        setCampaignId(campaignData.id);
        setCampaignName(campaignData.name);
        setSessionName(sessionResult.data.name || "Session");
      } catch (err) {
        console.error("SessionTabsLayout: error resolving slugs:", err);
        setIsNotFound(true);
      } finally {
        setResolving(false);
      }
    };

    resolveNames();
  }, [
    campaignSlug,
    sessionSlug,
    navigate,
    isGuest,
    authLoading,
    authState.user?.id,
  ]);

  if (resolving) {
    return (
      <div className="h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isNotFound) {
    return <NotFound />;
  }

  const effectiveCampaignName = campaignName;

  // Tab class helpers — these apply transition-all so font-size/weight/bg animate
  const activeTabClass =
    "px-3 py-1.5 text-sm lg:text-base font-bold dark:bg-gray-900 text-slate-900 dark:text-white rounded text-center transition-all duration-200 ease-in-out";
  const inactiveTabClass =
    "px-3 py-1.5 text-xs lg:text-sm font-medium text-slate-400 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover-fade-edges rounded text-center transition-all duration-200 ease-in-out";

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex flex-col font-sans overflow-hidden transition-colors duration-200">
      {/* Persistent Header — never unmounts on tab switch */}
      <header className="bg-white dark:bg-gray-900 flex flex-col lg:flex-row lg:h-16 lg:items-center lg:justify-between px-4 lg:px-6 shrink-0 transition-colors duration-200 z-10 gap-2 lg:gap-0">
        {/* Row 1: Back button + Breadcrumb */}
        <div className="flex items-center justify-between w-full lg:w-auto h-14 lg:h-auto gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              onClick={() => navigate(`/campaigns/${campaignSlug}`)}
              variant="ghost"
              className="text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white pl-0 shrink-0 hover:bg-transparent dark:hover:bg-transparent"
            >
              <span className="hidden lg:inline">Back</span>
              <span className="lg:hidden">←</span>
            </Button>
            <div className="h-6 w-px bg-slate-100 dark:bg-gray-700 mx-1 lg:mx-2 shrink-0" />
            <nav aria-label="Breadcrumb">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <a
                  href={`/campaigns/${campaignSlug}`}
                  className="text-xs lg:text-sm text-slate-400 dark:text-gray-500 truncate max-w-[80px] sm:max-w-[150px] lg:max-w-[200px] hover:text-slate-600 dark:hover:text-gray-300"
                >
                  {effectiveCampaignName}
                </a>
                <span
                  className="text-xs text-slate-300 dark:text-gray-600 shrink-0"
                  aria-hidden="true"
                >
                  /
                </span>
                <h1 className="text-base lg:text-lg font-semibold text-slate-900 dark:text-gray-100 truncate font-sans">
                  {sessionName}
                </h1>
              </div>
            </nav>
          </div>
          {/* Portal target for mobile actions */}
          <div
            id="mobile-header-actions-portal"
            className="flex items-center gap-1.5 md:hidden"
          />
        </div>

        <div className="w-full lg:w-auto pb-3 lg:pb-0 flex items-center justify-center">
          <nav
            className="flex flex-row items-center justify-center dark:bg-gray-800 p-1 shrink-0 rounded-md gap-1 w-auto"
            aria-label="Session navigation"
          >
            <button
              onClick={() =>
                navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug}`)
              }
              className={isWorkspace ? activeTabClass : inactiveTabClass}
              aria-current={isWorkspace ? "page" : undefined}
            >
              <span className="hidden lg:inline">Workspace</span>
              <span className="lg:hidden">Edit</span>
            </button>
            <button
              onClick={() =>
                navigate(
                  `/campaigns/${campaignSlug}/sessions/${sessionSlug}/journal`,
                )
              }
              className={isJournal ? activeTabClass : inactiveTabClass}
              aria-current={isJournal ? "page" : undefined}
            >
              Journal
            </button>
            <button
              onClick={() =>
                navigate(
                  `/campaigns/${campaignSlug}/sessions/${sessionSlug}/preferences`,
                )
              }
              className={isPreferences ? activeTabClass : inactiveTabClass}
              aria-current={isPreferences ? "page" : undefined}
            >
              Preferences
            </button>
          </nav>
        </div>

        {/* Desktop right spacer — keeps tabs visually centered */}
        <div className="hidden lg:block lg:w-1/4" />
      </header>

      {/* Page content — swaps on route change, header stays alive */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
