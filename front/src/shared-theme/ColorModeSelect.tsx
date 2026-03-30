import * as React from "react";
import IconButton from "@mui/material/IconButton";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import Tooltip from "@mui/material/Tooltip";
import { SxProps, Theme } from "@mui/material/styles";
import { ColorModeContext } from "./AppTheme";

type ColorModeSelectProps = {
  sx?: SxProps<Theme>;
};

// Funcao responsavel por alternar entre tema claro e escuro a partir do contexto global de tema.
export default function ColorModeSelect({ sx }: ColorModeSelectProps) {
  const { mode, toggleColorMode } = React.useContext(ColorModeContext);

  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "Usar tema claro" : "Usar tema escuro"}>
      <IconButton sx={sx} color="inherit" onClick={toggleColorMode}>
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
