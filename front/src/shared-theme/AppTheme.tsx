import * as React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

type ColorMode = "light" | "dark";

type ColorModeContextValue = {
  mode: ColorMode;
  toggleColorMode: () => void;
};

export const ColorModeContext = React.createContext<ColorModeContextValue>({
  mode: "dark",
  toggleColorMode: () => {},
});

// Funcao responsavel por montar o tema Material UI da aplicacao com paleta, componentes e overrides para claro/escuro.
function createAppTheme(mode: ColorMode) {
  const baseTheme = createTheme({
    shape: {
      borderRadius: 12,
    },
    palette: {
      mode,
      primary: {
        main: "#01325f",
        contrastText: "#ffffff",
      },
      secondary: {
        main: "#e96c4f",
        contrastText: "#000000",
      },
      background:
        mode === "dark"
          ? {
              default: "#000000",
              paper: "#000000",
            }
          : {
              default: "#ffffff",
              paper: "#ffffff",
            },
      text:
        mode === "dark"
          ? {
              primary: "#ffffff",
              secondary: "rgba(255, 255, 255, 0.75)",
            }
          : {
              primary: "#000000",
              secondary: "rgba(0, 0, 0, 0.75)",
            },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 14,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            paddingTop: 20,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            lineHeight: 1.3,
            marginBottom: 8,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: "1px solid rgba(233, 108, 79, 0.45)",
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            "&:hover": {
              backgroundColor: "rgba(233, 108, 79, 0.16)",
            },
            "&.Mui-selected": {
              backgroundColor: "rgba(1, 50, 95, 0.18)",
            },
            "&.Mui-selected:hover": {
              backgroundColor: "rgba(1, 50, 95, 0.26)",
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            borderRadius: 12,
            textTransform: "none",
            ...(theme.palette.mode === "dark" && ownerState.variant === "outlined"
              ? {
                  color: "#e96c4f",
                  borderColor: "rgba(233, 108, 79, 0.8)",
                  "&:hover": {
                    borderColor: "#e96c4f",
                    backgroundColor: "rgba(233, 108, 79, 0.14)",
                  },
                }
              : {}),
            ...(theme.palette.mode === "dark" && ownerState.variant === "text"
              ? {
                  color: "#e96c4f",
                  "&:hover": {
                    backgroundColor: "rgba(233, 108, 79, 0.14)",
                  },
                }
              : {}),
          }),
          containedPrimary: {
            backgroundColor: "#01325f",
            color: "#ffffff",
            "&:hover": {
              backgroundColor: "#012a4f",
            },
          },
          containedSecondary: {
            backgroundColor: "#e96c4f",
            color: "#000000",
            "&:hover": {
              backgroundColor: "#d95d40",
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            lineHeight: 1.2,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            "&:hover": {
              backgroundColor: "rgba(1, 50, 95, 0.12)",
            },
            "&.Mui-selected": {
              backgroundColor: "rgba(1, 50, 95, 0.2)",
            },
            "&.Mui-selected:hover": {
              backgroundColor: "rgba(1, 50, 95, 0.28)",
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: "#e96c4f",
            height: 3,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            ...(theme.palette.mode === "dark"
              ? {
                  color: "rgba(233, 108, 79, 0.72)",
                  "&.Mui-selected": {
                    color: "#e96c4f",
                  },
                }
              : {
                  "&.Mui-selected": {
                    color: "#01325f",
                  },
                }),
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: "#01325f",
            color: "#ffffff",
            fontWeight: 700,
          },
        },
      },
    },
  });

  (baseTheme as unknown as { applyStyles: (styleMode: string, styles: unknown) => unknown }).applyStyles = (
    styleMode,
    styles
  ) => {
    if (styleMode === "dark" && baseTheme.palette.mode === "dark") {
      return styles;
    }
    return {};
  };

  return baseTheme;
}

type AppThemeProps = React.PropsWithChildren<Record<string, unknown>>;

// Funcao responsavel por prover tema e contexto de alternancia de modo para toda a arvore de componentes.
export default function AppTheme({ children, ...props }: AppThemeProps) {
  const [mode, setMode] = React.useState<ColorMode>("dark");

  const colorMode = React.useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prev) => (prev === "dark" ? "light" : "dark"));
      },
    }),
    [mode]
  );

  const theme = React.useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme} {...props}>
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
