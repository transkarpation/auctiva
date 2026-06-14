import '@mantine/core/styles.css';

import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  AppShell,
  Burger,
  Button,
  Card,
  Center,
  Group,
  Loader,
  MantineProvider,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconGavel,
  IconListCheck,
  IconMoon,
  IconSun,
  IconWorld,
} from '@tabler/icons-react';
import { theme } from './theme';
import {
  ClerkLoaded,
  ClerkLoading,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/react';
import { DoubleNavbar, type RailItem } from './components/navbar/DoubleNavbar';
import { GroupsNav } from './components/tasks/GroupsNav';
import { GroupTasksPanel } from './components/tasks/GroupTasksPanel';
import { PublicGroupsNav } from './components/discover/PublicGroupsNav';
import { PublicGroupPanel } from './components/discover/PublicGroupPanel';
import { AuctionsNav } from './components/auctions/AuctionsNav';
import { MyAuctions } from './components/auctions/MyAuctions';
import { PublicAuctions } from './components/auctions/PublicAuctions';
import { AuctionDetail } from './components/auctions/AuctionDetail';
import { useGroups } from './hooks/useGroups';
import { usePublicGroups } from './hooks/usePublicGroups';
import { RealtimeMenu } from './components/realtime/RealtimeMenu';
import { RealtimeProvider } from './realtime/RealtimeProvider';

type View = 'tasks' | 'discover' | 'auctions';

const railItems: RailItem[] = [
  { key: 'tasks', label: 'My Tasks', icon: IconListCheck },
  { key: 'discover', label: 'Discover', icon: IconWorld },
  { key: 'auctions', label: 'Auctions', icon: IconGavel },
];

const navTitles: Record<View, string> = {
  tasks: 'My groups',
  discover: 'Public groups',
  auctions: 'Auctions',
};

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('dark');
  const isDark = computed === 'dark';
  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}

function SignedOutLanding() {
  return (
    <Center mih="100vh">
      <Card withBorder radius="md" padding="xl" w={380}>
        <Stack align="center">
          <Title order={2}>Auctiva</Title>
          <Text c="dimmed" ta="center" size="sm">
            Sign in to your account or create a new one to continue.
          </Text>
          <SignInButton mode="modal">
            <Button fullWidth>Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button fullWidth variant="default">
              Create account
            </Button>
          </SignUpButton>
        </Stack>
      </Card>
    </Center>
  );
}

function Dashboard() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const groups = useGroups();
  const publicGroups = usePublicGroups();

  // The active view is derived from the URL so it survives reloads and
  // back/forward navigation.
  const view: View = location.pathname.startsWith('/discover')
    ? 'discover'
    : location.pathname.startsWith('/auctions')
      ? 'auctions'
      : 'tasks';

  const selectView = (key: string) => {
    navigate(`/${key}`);
    close(); // collapse the navbar on mobile after choosing
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Auctiva</Title>
          </Group>
          <Group gap="sm">
            <RealtimeMenu />
            <ColorSchemeToggle />
            <UserButton />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={0}>
        <DoubleNavbar
          railItems={railItems}
          activeKey={view}
          onSelect={selectView}
          title={navTitles[view]}
        >
          {view === 'tasks' ? (
            <GroupsNav g={groups} />
          ) : view === 'discover' ? (
            <PublicGroupsNav p={publicGroups} />
          ) : (
            <AuctionsNav />
          )}
        </DoubleNavbar>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/tasks" element={<GroupTasksPanel g={groups} />} />
          <Route path="/tasks/:slug" element={<GroupTasksPanel g={groups} />} />
          <Route path="/discover" element={<PublicGroupPanel p={publicGroups} />} />
          <Route
            path="/discover/:groupId"
            element={<PublicGroupPanel p={publicGroups} />}
          />
          <Route path="/auctions" element={<MyAuctions />} />
          <Route path="/auctions/public" element={<PublicAuctions />} />
          <Route path="/auctions/:id" element={<AuctionDetail />} />
          <Route path="*" element={<Navigate to="/tasks" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

function AppContent() {
  const { isSignedIn } = useUser();
  return isSignedIn ? (
    <RealtimeProvider>
      <Dashboard />
    </RealtimeProvider>
  ) : (
    <SignedOutLanding />
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ClerkLoading>
        <Center mih="100vh">
          <Loader />
        </Center>
      </ClerkLoading>
      <ClerkLoaded>
        <AppContent />
      </ClerkLoaded>
    </MantineProvider>
  );
}
