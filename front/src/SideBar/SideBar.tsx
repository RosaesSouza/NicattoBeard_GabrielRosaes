import * as React from 'react';
import { useContext, useState } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import Collapse from '@mui/material/Collapse';
import { ColorModeContext } from '../shared-theme/AppTheme';
import { useAuth } from '../auth/AuthContext';

export type AppView = 'dashboard' | 'schedule' | 'crud' | 'history' | 'account';

export type SideBarProps = {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  onOpenAccount?: () => void;
  currentTab?: number;
  onSelectTab?: (tab: number) => void;
};

const drawerWidth = 216;

const Drawer = styled(MuiDrawer)({
  flexShrink: 0,
  boxSizing: 'border-box',
});

const mainItems: { label: string; icon: React.ReactNode; view: AppView }[] = [
  { label: 'Início', icon: <HomeRoundedIcon />, view: 'dashboard' },
  { label: 'Agendamento', icon: <EventAvailableRoundedIcon />, view: 'schedule' },
  { label: 'Gerenciamento', icon: <AssignmentRoundedIcon />, view: 'crud' },
  { label: 'Histórico', icon: <HistoryRoundedIcon />, view: 'history' },
];

const crudItems = [
  { label: 'Clientes', icon: <GroupRoundedIcon />, tabIndex: 0 },
  { label: 'Barbeiros', icon: <BadgeRoundedIcon />, tabIndex: 1 },
  { label: 'Especialidades', icon: <AutoAwesomeRoundedIcon />, tabIndex: 2 },
  { label: 'Serviços', icon: <ContentCutRoundedIcon />, tabIndex: 3 },
];

const secondaryItems = [];

const navItemSx = {
  transition: 'background-color 180ms ease, transform 180ms ease',
  '&:hover': {
    transform: 'translateX(3px)',
  },
};

const subItemSx = {
  transition: 'background-color 180ms ease, transform 180ms ease',
  '&:hover': {
    transform: 'translateX(4px)',
  },
};

// Componente principal da navegacao lateral (desktop) e menu superior/lateral (mobile).
// Funcao responsavel por renderizar a navegacao lateral/mobile, controlar selecao de visoes e acoes de usuario.
export default function SideBar({ currentView, onSelectView, onOpenAccount, currentTab = 0, onSelectTab }: SideBarProps) {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const { user, logout } = useAuth();

  // Estados de controle da interface.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [crudExpanded, setCrudExpanded] = useState(currentView === 'crud');
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Flags e dados derivados do usuario autenticado para personalizar o menu.
  const username = user?.name ?? user?.username ?? 'Usuário';
  const isBarberAdmin = user?.role === 'barbeiro' && user?.admin === true;
  const isBarberNonAdmin = user?.role === 'barbeiro' && user?.admin !== true;
  const isCliente = user?.role === 'cliente';

  // Define quais itens principais aparecem conforme o perfil logado.
  const visibleMainItems = React.useMemo(() => {
    return mainItems.filter((item) => {
      if (isCliente) return item.view !== 'crud' && item.view !== 'history';
      if (isBarberNonAdmin) return item.view === 'dashboard' || item.view === 'history';
      return item.view !== 'schedule';
    });
  }, [isBarberNonAdmin, isCliente]);

  // Define quais subtabs do CRUD aparecem; apenas admin acessa todas.
  const visibleCrudItems = React.useMemo(() => {
    return crudItems.filter((item) => {
      if (item.tabIndex === 1 || item.tabIndex === 2 || item.tabIndex === 3) {
        return isBarberAdmin;
      }

      return true;
    });
  }, [isBarberAdmin]);

  // Mantem itens secundarios preparados para expansao futura.
  const visibleSecondaryItems = React.useMemo(() => secondaryItems, []);

  // Calcula propriedades derivadas para layout e estado visual do menu.
  const computedWidth = collapsed ? 72 : drawerWidth;
  const isDarkMode = theme.palette.mode === 'dark';
  const isUserMenuOpen = Boolean(userMenuAnchorEl);

  // Abre o menu de usuario ancorado no avatar clicado.
  // Funcao responsavel por abrir o menu de usuario ancorado no avatar clicado.
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  // Fecha o menu de usuario.
  // Funcao responsavel por fechar o menu de usuario e limpar o elemento ancora.
  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  // Executa logout e fecha o menu de usuario para manter o fluxo consistente.
  // Funcao responsavel por encerrar sessao do usuario apos fechar o menu contextual.
  const handleLogout = () => {
    handleUserMenuClose();
    logout();
  };

  return (
    <>
      {/* Barra superior mobile com botao de menu e acesso rapido ao menu de usuario. */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 0.5,
          px: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          width: '100%',
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <IconButton size="small" onClick={() => setMobileOpen(true)}>
          <MenuRoundedIcon />
        </IconButton>
        <IconButton size="small" onClick={handleUserMenuOpen}>
          <Avatar
            alt="User profile"
            src="/user.png"
            sx={{ width: 38, height: 38 }}
          />
        </IconButton>
      </Box>

      {/* Drawer fixo da navegacao desktop com itens principais, CRUD e rodape do usuario. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          [`& .${drawerClasses.paper}`]: {
            width: computedWidth,
            backgroundColor: 'background.paper',
            overflowX: 'hidden',
            borderRight: `1px solid ${theme.palette.divider}`,
            transition: theme.transitions.create(['width', 'background-color'], {
              duration: theme.transitions.duration.shorter,
            }),
          },
          width: computedWidth,
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={collapsed ? 'center' : 'space-between'}
          sx={{
            px: 1,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 56,
          }}
        >
          {!collapsed && (
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              Menu
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={() => setCollapsed((prev) => !prev)}
            sx={{
              ml: collapsed ? 0 : 1,
            }}
          >
            {collapsed ? <ChevronRightRoundedIcon /> : <ChevronLeftRoundedIcon />}
          </IconButton>
        </Stack>
        <Divider />

        {/* Corpo navegavel do menu desktop. */}
        <Box
          sx={{
            overflow: 'auto',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
              {visibleMainItems.map((item) => (
                <React.Fragment key={item.label}>
                  <ListItem disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                      selected={currentView === item.view}
                      onClick={() => {
                        onSelectView(item.view);
                        if (item.view === 'crud') {
                          setCrudExpanded(!crudExpanded);
                        }
                      }}
                      sx={{
                        px: collapsed ? 1.5 : 2,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        minHeight: 40,
                        ...navItemSx,
                        '&.Mui-selected': {
                          backgroundColor: '#01325f',
                          color: '#ffffff',
                          '& .MuiListItemIcon-root': {
                            color: '#ffffff',
                          },
                          '&:hover': {
                            backgroundColor: '#012a4f',
                          },
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: collapsed ? 0 : 40,
                          justifyContent: 'center',
                          transition: 'transform 180ms ease',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {!collapsed && (
                        <>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              noWrap: true,
                              sx: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              },
                            }}
                          />
                          {item.view === 'crud' && !collapsed && (
                            <Box
                              sx={{
                                ml: 'auto',
                                display: 'flex',
                                transition: 'transform 180ms ease',
                                transform: crudExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            >
                              <ExpandMoreRoundedIcon fontSize="small" />
                            </Box>
                          )}
                        </>
                      )}
                    </ListItemButton>
                  </ListItem>
                  
                  {item.view === 'crud' && crudExpanded && !collapsed && (
                    <Collapse in={crudExpanded} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding dense>
                        {visibleCrudItems.map((crudItem, index) => (
                          <ListItem
                            key={crudItem.label}
                            disablePadding
                            sx={{
                              display: 'block',
                              animation: 'fadeInPage 220ms ease-out both',
                              animationDelay: `${index * 40}ms`,
                            }}
                          >
                            <ListItemButton
                              selected={currentView === 'crud' && currentTab === crudItem.tabIndex}
                              onClick={() => {
                                onSelectView('crud');
                                onSelectTab?.(crudItem.tabIndex);
                              }}
                              sx={{
                                pl: 4,
                                pr: 2,
                                minHeight: 36,
                                fontSize: '0.9rem',
                                ...subItemSx,
                                '&.Mui-selected': {
                                  backgroundColor: '#e96c4f',
                                  color: '#000000',
                                  '& .MuiListItemIcon-root': {
                                    color: '#000000',
                                  },
                                  '&:hover': {
                                    backgroundColor: '#d95d40',
                                  },
                                },
                              }}
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 36,
                                  justifyContent: 'center',
                                }}
                              >
                                {crudItem.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={crudItem.label}
                                primaryTypographyProps={{
                                  noWrap: true,
                                  sx: {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '0.9rem',
                                  },
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  )}
                </React.Fragment>
              ))}
            </List>
            <List dense sx={{ mt: 1 }}>
              <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  onClick={() => colorMode.toggleColorMode()}
                  sx={{
                    px: collapsed ? 1.5 : 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    minHeight: 40,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 40,
                      justifyContent: 'center',
                    }}
                  >
                    {isDarkMode ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary="Tema"
                      primaryTypographyProps={{
                        noWrap: true,
                        sx: {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
              {visibleSecondaryItems.map((item) => (
                <ListItem key={item.label} disablePadding sx={{ display: 'block' }}>
                  <ListItemButton
                    sx={{
                      px: collapsed ? 1.5 : 2,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      minHeight: 40,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 40,
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          noWrap: true,
                          sx: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                        }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Stack>
        </Box>

        {/* Rodape desktop com avatar e atalho para menu de usuario. */}
        <Stack
          direction="row"
          onClick={handleUserMenuOpen}
          sx={{
            p: 2,
            gap: 1,
            alignItems: 'center',
            borderTop: '1px solid',
            borderColor: 'divider',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <Avatar
            sizes="small"
            alt="User profile"
            src="/user.png"
            sx={{ width: 36, height: 36 }}
          />
          {!collapsed && (
            <Box sx={{ mr: 'auto', minWidth: 0, maxWidth: '100%' }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                noWrap
              >
                {username}
              </Typography>
            </Box>
          )}
          {!collapsed && <MoreVertRoundedIcon fontSize="small" color="action" />}
        </Stack>
      </Drawer>

      {/* Drawer temporario mobile aberto pelo botao hamburguer. */}
      <Drawer
        variant="temporary"
        anchor="top"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          [`& .${drawerClasses.paper}`]: {
            width: '100%',
            maxHeight: '64vh',
            backgroundColor: 'background.paper',
            overflowX: 'hidden',
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1,
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 48,
          }}
        >
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
            Menu
          </Typography>
          <IconButton size="small" onClick={() => setMobileOpen(false)}>
            <ChevronLeftRoundedIcon />
          </IconButton>
        </Stack>
        <Divider />

        {/* Corpo navegavel do menu mobile com itens e alternancia de tema. */}
        <Box
          sx={{
            overflow: 'auto',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
              {visibleMainItems.map((item) => (
                <React.Fragment key={item.label}>
                  <ListItem disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                      selected={currentView === item.view}
                      onClick={() => {
                        onSelectView(item.view);
                        if (item.view === 'crud') {
                          setCrudExpanded(!crudExpanded);
                        } else {
                          setMobileOpen(false);
                        }
                      }}
                      sx={{
                        px: 2,
                        justifyContent: 'flex-start',
                        minHeight: 34,
                        ...navItemSx,
                        '&.Mui-selected': {
                          backgroundColor: '#01325f',
                          color: '#ffffff',
                          '& .MuiListItemIcon-root': {
                            color: '#ffffff',
                          },
                          '&:hover': {
                            backgroundColor: '#012a4f',
                          },
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 40,
                          justifyContent: 'center',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          noWrap: true,
                          sx: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                        }}
                      />
                      {item.view === 'crud' && (
                        <Box
                          sx={{
                            ml: 'auto',
                            display: 'flex',
                            transition: 'transform 180ms ease',
                            transform: crudExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          <ExpandMoreRoundedIcon fontSize="small" />
                        </Box>
                      )}
                    </ListItemButton>
                  </ListItem>

                  {item.view === 'crud' && crudExpanded && (
                    <Collapse in={crudExpanded} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding dense>
                        {visibleCrudItems.map((crudItem, index) => (
                          <ListItem
                            key={crudItem.label}
                            disablePadding
                            sx={{
                              display: 'block',
                              animation: 'fadeInPage 220ms ease-out both',
                              animationDelay: `${index * 40}ms`,
                            }}
                          >
                            <ListItemButton
                              selected={currentView === 'crud' && currentTab === crudItem.tabIndex}
                              onClick={() => {
                                onSelectView('crud');
                                onSelectTab?.(crudItem.tabIndex);
                                setMobileOpen(false);
                              }}
                              sx={{
                                pl: 4,
                                pr: 2,
                                minHeight: 32,
                                fontSize: '0.9rem',
                                ...subItemSx,
                                '&.Mui-selected': {
                                  backgroundColor: '#e96c4f',
                                  color: '#000000',
                                  '& .MuiListItemIcon-root': {
                                    color: '#000000',
                                  },
                                  '&:hover': {
                                    backgroundColor: '#d95d40',
                                  },
                                },
                              }}
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 36,
                                  justifyContent: 'center',
                                }}
                              >
                                {crudItem.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={crudItem.label}
                                primaryTypographyProps={{
                                  noWrap: true,
                                  sx: {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '0.9rem',
                                  },
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  )}
                </React.Fragment>
              ))}
            </List>
            <List dense sx={{ mt: 1 }}>
              <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  onClick={() => {
                    colorMode.toggleColorMode();
                    setMobileOpen(false);
                  }}
                  sx={{
                    px: 2,
                    justifyContent: 'flex-start',
                    minHeight: 34,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      justifyContent: 'center',
                    }}
                  >
                    {isDarkMode ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Tema"
                    primaryTypographyProps={{
                      noWrap: true,
                      sx: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
              {visibleSecondaryItems.map((item) => (
                <ListItem key={item.label} disablePadding sx={{ display: 'block' }}>
                  <ListItemButton
                    sx={{
                      px: 2,
                      justifyContent: 'flex-start',
                      minHeight: 40,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        noWrap: true,
                        sx: {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Stack>
        </Box>
      </Drawer>

      {/* Menu contextual do usuario para abrir conta e sair da sessao. */}
      <Menu
        anchorEl={userMenuAnchorEl}
        open={isUserMenuOpen}
        onClose={handleUserMenuClose}
        onClick={handleUserMenuClose}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            onOpenAccount?.();
          }}
        >
          <ListItemIcon>
            <AccountCircleRoundedIcon fontSize="small" />
          </ListItemIcon>
          Minha conta
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemText>Sair</ListItemText>
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
        </MenuItem>
      </Menu>
    </>
  );
}
