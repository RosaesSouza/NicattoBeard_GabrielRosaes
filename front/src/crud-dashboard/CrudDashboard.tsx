import React, { useMemo, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../auth/AuthContext';
import ClientesCrud from '../crud-pages/ClientesCrud';
import BarbeirosCrud from '../crud-pages/BarbeirosCrud';
import EspecialidadesCrud from '../crud-pages/EspecialidadesCrud';
import ServicosCrud from '../crud-pages/ServicosCrud';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Funcao responsavel por renderizar o conteudo de cada aba apenas quando ela estiver ativa.
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`crud-tabpanel-${index}`}
      aria-labelledby={`crud-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

// Funcao responsavel por montar o painel de CRUD, controlar abas disponiveis por perfil e alternar conteudo administrativo.
export default function CrudDashboard({ initialTab = 0, onTabChange }: { initialTab?: number; onTabChange?: (tab: number) => void }) {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(initialTab);

  const isBarberAdmin = user?.role === 'barbeiro' && user?.admin === true;

  const availableTabs = useMemo(() => {
    const tabs = [{ value: 0, label: 'Clientes' }];

    if (isBarberAdmin) {
      tabs.push(
        { value: 1, label: 'Barbeiros' },
        { value: 2, label: 'Especialidades' },
        { value: 3, label: 'Serviços' }
      );
    }

    return tabs;
  }, [isBarberAdmin]);

  React.useEffect(() => {
    const isTabAvailable = availableTabs.some((tab) => tab.value === initialTab);
    const nextTab = isTabAvailable ? initialTab : availableTabs[0]?.value ?? 0;
    setTabValue(nextTab);
  }, [initialTab, availableTabs]);

  // Funcao responsavel por atualizar a aba atual e notificar o componente pai sobre a troca de contexto.
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    onTabChange?.(newValue);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', p: { xs: 0.5, sm: 1, md: 1.5 } }}>
      <Paper
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(90deg, rgba(1,50,95,0.7), rgba(233,108,79,0.24))'
            : 'linear-gradient(90deg, rgba(1,50,95,0.08), rgba(233,108,79,0.2))',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="crud tabs"
          variant={isMobile ? 'standard' : 'scrollable'}
          scrollButtons={isMobile ? false : 'auto'}
          centered={isMobile}
          sx={{
            minHeight: { xs: 34, md: 44 },
            maxWidth: '100%',
            '& .MuiTabs-indicator': {
              backgroundColor: '#e96c4f',
            },
            '& .MuiTabs-scrollButtons': {
              width: { xs: 22, md: 28 },
            },
            '& .MuiTab-root': {
              minHeight: { xs: 34, md: 44 },
              py: { xs: 0.25, md: 0.8 },
              px: { xs: 0.8, md: 1.5 },
              minWidth: { xs: 72, md: 96 },
              fontSize: { xs: '0.72rem', md: '0.86rem' },
            },
          }}
        >
          {availableTabs.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              id={`crud-tab-${tab.value}`}
              aria-controls={`crud-tabpanel-${tab.value}`}
              sx={{
                color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.82)' : 'text.secondary',
                '&.Mui-selected': {
                  color: theme.palette.mode === 'dark' ? '#e96c4f' : '#01325f',
                },
              }}
            />
          ))}
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <ClientesCrud />
      </TabPanel>

      {isBarberAdmin && (
        <>
          <TabPanel value={tabValue} index={1}>
            <BarbeirosCrud />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <EspecialidadesCrud />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <ServicosCrud />
          </TabPanel>
        </>
      )}
    </Box>
  );
}
