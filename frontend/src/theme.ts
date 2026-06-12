import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Near-black palette overriding Mantine's default (grayish) dark shades.
// Index meaning in Mantine: [7] = body background, [6] = elevated surfaces
// (cards/inputs), [4] = borders, [0] = primary text.
const black: MantineColorsTuple = [
  '#c9c9c9', // 0 — text
  '#b8b8b8', // 1
  '#828282', // 2
  '#696969', // 3
  '#3a3a3a', // 4 — borders
  '#2a2a2a', // 5
  '#181818', // 6 — cards / inputs
  '#101010', // 7 — body background
  '#0a0a0a', // 8
  '#000000', // 9 — pure black
];

export const theme = createTheme({
  colors: {
    dark: black,
  },
  primaryColor: 'blue',
});
