import StudioSidebar from '@/components/studio/Sidebar';
import AccountDialog from '@/components/studio/AccountDialog';
import AuthDialog from '@/components/studio/AuthDialog';
import SiteFooter from '@/components/studio/SiteFooter';
import StudioHeader from '@/components/studio/StudioHeader';
import StudioContent from '@/components/studio/StudioContent';
import MobileMenu from '@/components/studio/MobileMenu';
import { useStudioPage } from '@/hooks/useStudioPage';
import { saveProfile, fetchUsage } from '@/lib/api';

const STAGE_IMAGE =
  'https://cdn.poehali.dev/projects/1b7a339a-91f0-4ef8-9965-ce631414fd64/files/8a003fe7-72fb-4cd1-b63b-928feb3c181e.jpg';

const Index = () => {
  const studio = useStudioPage();
  const {
    section,
    setError,
    menuOpen,
    setMenuOpen,
    accountOpen,
    setAccountOpen,
    authOpen,
    setAuthOpen,
    user,
    setUser,
    profile,
    setProfile,
    usage,
    setUsage,
    handleSection,
    handleLogout,
  } = studio;

  const sidebar = (
    <StudioSidebar
      current={section}
      onSelect={handleSection}
      onAccount={() => {
        if (user) setAccountOpen(true);
        else setAuthOpen(true);
        setMenuOpen(false);
      }}
      userName={user ? profile.name : 'Войти по почте'}
      credits={user?.isAdmin ? 999999 : 50}
      guest={!user}
      onClose={() => setMenuOpen(false)}
    />
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-2.5">
      <div className="flex min-h-[calc(100vh-20px)] gap-2.5">
        <div className="sticky top-2.5 hidden h-[calc(100vh-20px)] w-[234px] flex-none lg:block">
          {sidebar}
        </div>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] bg-stage">
          <div
            className="stage-veil pointer-events-none absolute inset-0 rounded-[14px] bg-cover"
            style={{ backgroundImage: `url(${STAGE_IMAGE})`, backgroundPosition: 'center 42%' }}
            aria-hidden
          />

          <div className="relative z-10 flex flex-1 flex-col">
            <StudioHeader
              onOpenMenu={() => setMenuOpen(true)}
              onAccount={() => (user ? setAccountOpen(true) : setAuthOpen(true))}
            />

            <StudioContent studio={studio} />

            <SiteFooter />
          </div>
        </main>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        {sidebar}
      </MobileMenu>

      <AccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        userName={profile.name}
        email={profile.email}
        usage={usage}
        onSave={(name, email) => {
          setProfile({ name, email });
          saveProfile(email, name, 'standard').catch(() => undefined);
        }}
        onLogout={handleLogout}
      />

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuth={(me) => {
          setUser(me);
          setProfile({ name: me.name, email: me.email });
          setAuthOpen(false);
          setError(null);
          fetchUsage(me.email).then(setUsage).catch(() => undefined);
        }}
      />
    </div>
  );
};

export default Index;
