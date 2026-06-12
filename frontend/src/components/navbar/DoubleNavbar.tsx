import type { ReactNode } from 'react';
import { Title, Tooltip, UnstyledButton } from '@mantine/core';
import { IconLayoutGrid, type IconProps } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import classes from './DoubleNavbar.module.css';

export type RailItem = {
  key: string;
  label: string;
  icon: ComponentType<IconProps>;
};

type Props = {
  railItems: RailItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  title: string;
  children: ReactNode; // wide-column content (the scrollable list)
  footer?: ReactNode; // bottom of the icon rail (e.g. user button)
};

export function DoubleNavbar({
  railItems,
  activeKey,
  onSelect,
  title,
  children,
  footer,
}: Props) {
  const mainLinks = railItems.map((item) => (
    <Tooltip
      label={item.label}
      position="right"
      withArrow
      transitionProps={{ duration: 0 }}
      key={item.key}
    >
      <UnstyledButton
        onClick={() => onSelect(item.key)}
        className={classes.mainLink}
        data-active={item.key === activeKey || undefined}
        aria-label={item.label}
      >
        <item.icon size={22} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  ));

  return (
    <nav className={classes.navbar}>
      <div className={classes.wrapper}>
        <div className={classes.aside}>
          <div className={classes.logo}>
            <IconLayoutGrid size={28} stroke={1.5} />
          </div>
          {mainLinks}
          <div style={{ flex: 1 }} />
          {footer}
        </div>
        <div className={classes.main}>
          <Title order={4} className={classes.title}>
            {title}
          </Title>
          <div className={classes.listScroll}>{children}</div>
        </div>
      </div>
    </nav>
  );
}
