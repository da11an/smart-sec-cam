import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuIcon from '@mui/icons-material/Menu';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#2e2e2e',
        },
        secondary: {
            main: "#1976d2",
        }
    },
});

export default function ButtonAppBar(props) {
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);

    // Handlers for the menu
    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const goToPage = (path) => {
        navigate(path, { state: { token: props.token } });
        handleMenuClose();
    };

    return (
        <Box sx={{
            flexGrow: 0,
            height: '48px',
            minHeight: '48px',
            maxHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
        }}>
            <ThemeProvider theme={darkTheme}>
                <AppBar position="static">
                    <Toolbar variant="dense" color="primary">
                        {/* Menu Icon with Dropdown */}
                        <IconButton
                            size="large"
                            edge="start"
                            color="inherit"
                            aria-label="menu"
                            sx={{ mr: 2 }}
                            onClick={handleMenuOpen}
                        >
                            <MenuIcon />
                        </IconButton>

                        {/* Dropdown Menu */}
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                        >
                            <MenuItem onClick={() => goToPage('/videos')}>Videos</MenuItem>
                            <MenuItem onClick={() => goToPage('/stream')}>Stream</MenuItem>
                        </Menu>

                        {/* App Title */}
                        <Typography variant="h6" component="div" align="left" sx={{ flexGrow: 1 }}>
                            Smart Home and Nature Camera
                        </Typography>
                    </Toolbar>
                </AppBar>
            </ThemeProvider>
        </Box>
    );
}
