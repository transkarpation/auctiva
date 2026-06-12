import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink, Stack } from '@mantine/core';

// Wide-column content for the Auctions view: switch between own and public.
export function AuctionsNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onPublic = pathname.startsWith('/auctions/public');

  return (
    <Stack gap={4}>
      <NavLink
        label="My auctions"
        active={!onPublic}
        onClick={() => navigate('/auctions')}
      />
      <NavLink
        label="Public auctions"
        active={onPublic}
        onClick={() => navigate('/auctions/public')}
      />
    </Stack>
  );
}
