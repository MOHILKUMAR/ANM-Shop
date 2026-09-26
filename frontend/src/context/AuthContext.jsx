
import { useEffect, useState } from "react";
import AuthContext from "./AuthContext.js";
import { SESSION_EXPIRED_EVENT } from "../api.js";

// Reads the JWT's `exp` claim (seconds). The server still verifies the token; this only
// avoids showing a signed-in UI for a token that has already expired.
function isTokenExpired(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const { exp } = JSON.parse(atob(payload));
        return typeof exp === "number" && exp * 1000 <= Date.now();
    } catch {
        return true;
    }
}

function readSavedUser() {
    try {
        const savedUser = JSON.parse(localStorage.getItem("userInfo"));
        if (savedUser?.token && !isTokenExpired(savedUser.token)) return savedUser;
        localStorage.removeItem("userInfo");
    } catch {
        // Unreadable storage: start signed out.
    }
    return null;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(readSavedUser);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem("userInfo", JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("userInfo");
    }

    useEffect(() => {
        const handleExpired = () => {
            setUser(null);
            localStorage.removeItem("userInfo");
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    }, []);

    return (
        <AuthContext.Provider value={{user, login ,logout }}>
        {children}
        </AuthContext.Provider>
    )

}
