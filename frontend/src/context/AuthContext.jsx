
import { useState } from "react";
import AuthContext from "./AuthContext.js";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("userInfo")) || null;
        } catch {
            return null;
        }
    });

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem("userInfo", JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("userInfo");
    }

    return (
        <AuthContext.Provider value={{user, login ,logout }}>
        {children}
        </AuthContext.Provider>
    )

}