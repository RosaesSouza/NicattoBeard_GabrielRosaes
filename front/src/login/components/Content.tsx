import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// Funcao responsavel por exibir a area visual da tela de login com a marca da aplicacao.
export default function Content() {
  return (
    <Stack
      sx={{
        flexDirection: 'column',
        alignSelf: { xs: 'stretch', lg: 'center' },
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1.5, sm: 3 },
        maxWidth: { xs: '100%', lg: 680 },
        width: '100%',
        py: { xs: 1, lg: 2 },
      }}
    >
      <Box
        component="img"
        src="/logo.webp"
        alt="Nicatto Beard Logo"
        sx={{
          width: { xs: 190, sm: 280, md: 360, lg: 520 },
          height: 'auto',
          filter: 'drop-shadow(0 18px 32px rgba(0, 0, 0, 0.5))',
        }}
      />
    </Stack>
  );
}
