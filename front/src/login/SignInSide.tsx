import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ColorModeSelect from '../shared-theme/ColorModeSelect';
import SignInCard from './components/SignInCard';
import Content from './components/Content';

// Funcao responsavel por montar a tela de autenticacao com alternancia de tema, identidade visual e card de login/cadastro.
export default function SignInSide(props: { disableCustomTheme?: boolean; onLoginSuccess?: () => void }) {
  const [mode, setMode] = React.useState<'login' | 'register' | null>(null);
  const getCurrentYear = () => new Date().getFullYear();

  return (
    <>
      <ColorModeSelect
        sx={{
          position: 'fixed',
          top: { xs: '0.75rem', sm: '1rem' },
          right: { xs: '0.75rem', sm: '1rem' },
          zIndex: 3,
        }}
      />
      <Stack
        direction="column"
        component="main"
        sx={{
          minHeight: { xs: '100dvh', md: '100vh' },
          justifyContent: 'space-between',
          position: 'relative',
          overflowX: 'hidden',
          overflowY: { xs: 'auto', md: 'hidden' },
          WebkitOverflowScrolling: 'touch',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            backgroundImage: 'url(/back.webp)',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            background: 'linear-gradient(115deg, rgba(5, 19, 31, 0.9) 0%, rgba(5, 19, 31, 0.74) 45%, rgba(5, 19, 31, 0.45) 100%)',
          },
        }}
      >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        sx={{
          width: '100%',
          maxWidth: 1500,
          mx: 'auto',
          px: { xs: 2, md: 4, lg: 6 },
          pt: { xs: 3, md: 5, lg: 7 },
          pb: { xs: 2, md: 3, lg: 4 },
          gap: { xs: 2.5, md: 4, lg: 8 },
          alignItems: { xs: 'stretch', lg: 'center' },
          flex: 1,
        }}
      >
        <Content />

        <Box sx={{ width: '100%', maxWidth: { xs: '100%', lg: mode === 'register' ? 920 : 560 } }}>
          {!mode && (
            <>
              <Box
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderRadius: 2,
                  mb: 1.5,
                  backgroundColor: 'rgba(12, 19, 31, 0.72)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: { xs: '1rem', md: '1.2rem' },
                    lineHeight: 1.35,
                  }}
                >
                  Bem vindo a Nicatto Beard, faca login para agendar seu horario.
                </Typography>
              </Box>

              <Button
                fullWidth
                variant="contained"
                onClick={() => setMode('login')}
                sx={{
                  mb: 1,
                  py: 1.2,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: { xs: '1.02rem', md: '1.12rem' },
                  letterSpacing: 0.25,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #de7a4f 0%, #c4633d 100%)',
                  boxShadow: '0 10px 22px rgba(196, 99, 61, 0.35)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #e28359 0%, #b85734 100%)',
                    boxShadow: '0 12px 24px rgba(196, 99, 61, 0.45)',
                  },
                }}
              >
                Entrar
              </Button>

              <Button
                fullWidth
                variant="contained"
                onClick={() => setMode('register')}
                sx={{
                  py: 1.05,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#fff',
                  backgroundColor: '#3c5f89',
                  '&:hover': {
                    backgroundColor: '#355478',
                  },
                }}
              >
                Cadastre-se
              </Button>
            </>
          )}

          {mode && (
            <>
              <SignInCard mode={mode} onLoginSuccess={props.onLoginSuccess} />
              <Typography
                variant="body2"
                sx={{
                  mt: 1.5,
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.95)',
                }}
              >
                {mode === 'login' ? 'Nao tem conta?' : 'Ja tem conta?'}{' '}
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  sx={{ color: '#ffd2b8', fontWeight: 700 }}
                >
                  {mode === 'login' ? 'Cadastre-se' : 'Fazer login'}
                </Link>
              </Typography>
            </>
          )}
        </Box>
      </Stack>

      <Box
        component="footer"
        sx={{
          px: { xs: 2, md: 4 },
          py: 2,
          color: 'rgba(255, 255, 255, 0.9)',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(2px)',
        }}
      >
        <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 600 }}>
          © Nicatto Beard {getCurrentYear()}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
          Contatos: (11) 98888-7777 | contato@nicattobeard.com.br | @nicattobeard
        </Typography>
      </Box>
      </Stack>
    </>
  );
}
