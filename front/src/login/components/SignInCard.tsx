import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MuiCard from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { styled } from '@mui/material/styles';
import { useAuth } from '../../auth/AuthContext';
import { formatPhoneBR, isStrongPassword, isValidEmail } from '../../utils/formUtils';

type SignInCardProps = {
  mode: 'login' | 'register';
  onLoginSuccess?: () => void;
};

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  boxShadow:
    '0px 5px 15px rgba(0, 0, 0, 0.08), 0px 15px 35px rgba(0, 0, 0, 0.05)',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    gap: theme.spacing(1.5),
  },
  ...theme.applyStyles('dark', {
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.6), 0 18px 45px rgba(0, 0, 0, 0.4)',
  }),
}));

// Funcao responsavel por renderizar e controlar os formularios de login e cadastro de cliente na mesma interface.
export default function SignInCard({ mode, onLoginSuccess }: SignInCardProps) {
  const { login, registerCliente } = useAuth();
  const [loginData, setLoginData] = React.useState({ email: '', senha: '' });
  const [registerData, setRegisterData] = React.useState({
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    confirmarSenha: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const passwordChecks = React.useMemo(() => {
    const senha = registerData.senha || '';
    return {
      minLen: senha.length >= 6,
      hasLower: /[a-z]/.test(senha),
      hasUpper: /[A-Z]/.test(senha),
      hasNumber: /\d/.test(senha),
      hasSymbol: /[^A-Za-z\d]/.test(senha),
    };
  }, [registerData.senha]);

  // Funcao responsavel por limpar mensagens anteriores de erro e sucesso quando o usuario altera dados do formulario.
  const clearFeedback = () => {
    if (errorMessage || successMessage) {
      setErrorMessage('');
      setSuccessMessage('');
    }
  };

  React.useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(false);
  }, [mode]);

  // Funcao responsavel por alternar visibilidade do campo de senha para melhorar a usabilidade no preenchimento.
  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  // Funcao responsavel por validar credenciais basicas e executar o login do usuario autenticando na API.
  const handleSubmitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loginData.email || !loginData.senha) {
      setErrorMessage('Informe email e senha.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(loginData.email.trim(), loginData.senha);
      if (!result.ok) {
        setErrorMessage(result.message ?? 'Email ou senha inválidos.');
        return;
      }
      setSuccessMessage('Login realizado com sucesso!');
      if (onLoginSuccess) onLoginSuccess();
    } catch {
      setErrorMessage('Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Funcao responsavel por validar requisitos de cadastro e criar conta de cliente no backend.
  const handleSubmitRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!registerData.nome.trim()) {
      setErrorMessage('Nome é obrigatório.');
      return;
    }

    if (!isValidEmail(registerData.email)) {
      setErrorMessage('Email inválido.');
      return;
    }

    if (registerData.telefone && registerData.telefone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Telefone inválido. Informe DDD e número com 10 ou 11 dígitos.');
      return;
    }

    if (!isStrongPassword(registerData.senha)) {
      setErrorMessage('A senha deve conter ao menos 6 caracteres com maiúscula, minúscula, número e símbolo.');
      return;
    }

    if (registerData.senha !== registerData.confirmarSenha) {
      setErrorMessage('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      const result = await registerCliente({
        nome: registerData.nome.trim(),
        email: registerData.email.trim().toLowerCase(),
        telefone: registerData.telefone || null,
        senha: registerData.senha,
      });

      if (!result.ok) {
        setErrorMessage(result.message ?? 'Não foi possível finalizar o cadastro.');
        return;
      }

      setSuccessMessage('Cadastro concluído! Você já está logado como cliente.');
      if (onLoginSuccess) onLoginSuccess();
    } catch {
      setErrorMessage('Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      sx={{
        maxWidth: mode === 'register' ? { xs: '100%', md: 920 } : { xs: '100%', md: 560 },
        width: { xs: '100%', sm: 'auto' },
        mx: 'auto',
      }}
    >
      <Typography
        component="h1"
        variant="h4"
        sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
      >
        {mode === 'login' ? 'Login' : 'Cadastro de Cliente'}
      </Typography>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      {successMessage && <Alert severity="success">{successMessage}</Alert>}

      {mode === 'login' ? (
      <Box
        component="form"
        onSubmit={handleSubmitLogin}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}
      >
        <FormControl>
          <FormLabel htmlFor="email">Email</FormLabel>
          <TextField
            id="email"
            type="email"
            name="email"
            placeholder="seu.email@dominio.com"
            autoComplete="email"
            autoFocus
            required
            fullWidth
            variant="outlined"
            value={loginData.email}
            onChange={(event) => {
              clearFeedback();
              setLoginData((prev) => ({ ...prev, email: event.target.value }));
            }}
          />
        </FormControl>
        <FormControl>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <FormLabel htmlFor="senha">Senha</FormLabel>
          </Box>
          <TextField
            name="senha"
            placeholder="••••••"
            type={showPassword ? 'text' : 'password'}
            id="senha"
            autoComplete="current-password"
            required
            fullWidth
            variant="outlined"
            value={loginData.senha}
            onChange={(event) => {
              clearFeedback();
              setLoginData((prev) => ({ ...prev, senha: event.target.value }));
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePassword}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </FormControl>
        <Button type="submit" fullWidth variant="contained" color="secondary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </Box>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmitRegister}
          noValidate
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            columnGap: { xs: 1.5, md: 2 },
            rowGap: { xs: 1.5, md: 2 },
            width: '100%',
          }}
        >
          <FormControl>
            <FormLabel htmlFor="nome">Nome</FormLabel>
            <TextField
              id="nome"
              type="text"
              name="nome"
              placeholder="Seu nome"
              autoFocus
              required
              fullWidth
              variant="outlined"
              value={registerData.nome}
              onChange={(event) => {
                clearFeedback();
                setRegisterData((prev) => ({ ...prev, nome: event.target.value }));
              }}
            />
          </FormControl>

          <FormControl sx={{ gridColumn: { xs: '1 / -1', md: '1 / 2' } }}>
            <FormLabel htmlFor="telefone">Telefone (opcional)</FormLabel>
            <TextField
              id="telefone"
              type="tel"
              name="telefone"
              placeholder="(11) 99999-9999"
              fullWidth
              variant="outlined"
              value={registerData.telefone}
              onChange={(event) => {
                clearFeedback();
                setRegisterData((prev) => ({ ...prev, telefone: formatPhoneBR(event.target.value) }));
              }}
            />
          </FormControl>

          <FormControl sx={{ gridColumn: { xs: '1 / -1', md: '1 / 2' } }}>
            <FormLabel htmlFor="email">Email</FormLabel>
            <TextField
              id="email"
              type="email"
              name="email"
              placeholder="seu.email@dominio.com"
              required
              fullWidth
              variant="outlined"
              value={registerData.email}
              onChange={(event) => {
                clearFeedback();
                setRegisterData((prev) => ({ ...prev, email: event.target.value.trimStart().toLowerCase() }));
              }}
            />
          </FormControl>

          <FormControl sx={{ gridColumn: { xs: '1 / -1', md: '2 / 3' }, gridRow: { md: 1 } }}>
            <FormLabel htmlFor="senhaCadastro">Senha</FormLabel>
            <TextField
              name="senhaCadastro"
              placeholder="••••••"
              type={showPassword ? 'text' : 'password'}
              id="senhaCadastro"
              autoComplete="new-password"
              required
              fullWidth
              variant="outlined"
              value={registerData.senha}
              onChange={(event) => {
                clearFeedback();
                setRegisterData((prev) => ({ ...prev, senha: event.target.value }));
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </FormControl>

          <FormControl sx={{ gridColumn: { xs: '1 / -1', md: '2 / 3' }, gridRow: { md: 2 } }}>
            <FormLabel htmlFor="confirmarSenha">Confirmar senha</FormLabel>
            <TextField
              name="confirmarSenha"
              placeholder="••••••"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmarSenha"
              autoComplete="new-password"
              required
              fullWidth
              variant="outlined"
              value={registerData.confirmarSenha}
              onChange={(event) => {
                clearFeedback();
                setRegisterData((prev) => ({ ...prev, confirmarSenha: event.target.value }));
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </FormControl>

          <Box
            sx={{
              gridColumn: { xs: '1 / -1', md: '2 / 3' },
              gridRow: { md: 3 },
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.8, fontWeight: 700 }}>
              Requisitos da senha
            </Typography>
            <Typography variant="caption" display="block" color={passwordChecks.minLen ? 'success.main' : 'text.secondary'}>
              {passwordChecks.minLen ? 'OK' : 'Pendente'} Minimo de 6 caracteres
            </Typography>
            <Typography variant="caption" display="block" color={passwordChecks.hasLower ? 'success.main' : 'text.secondary'}>
              {passwordChecks.hasLower ? 'OK' : 'Pendente'} Letra minuscula
            </Typography>
            <Typography variant="caption" display="block" color={passwordChecks.hasUpper ? 'success.main' : 'text.secondary'}>
              {passwordChecks.hasUpper ? 'OK' : 'Pendente'} Letra maiuscula
            </Typography>
            <Typography variant="caption" display="block" color={passwordChecks.hasNumber ? 'success.main' : 'text.secondary'}>
              {passwordChecks.hasNumber ? 'OK' : 'Pendente'} Numero
            </Typography>
            <Typography variant="caption" display="block" color={passwordChecks.hasSymbol ? 'success.main' : 'text.secondary'}>
              {passwordChecks.hasSymbol ? 'OK' : 'Pendente'} Simbolo especial
            </Typography>
          </Box>

          <Button type="submit" fullWidth variant="contained" color="secondary" disabled={loading} sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }}>
            {loading ? 'Cadastrando...' : 'Criar conta de cliente'}
          </Button>
        </Box>
      )}
    </Card>
  );
}
