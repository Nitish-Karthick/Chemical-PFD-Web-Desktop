import { Routes, Route, Navigate, Outlet } from "react-router-dom";

// Layouts
import MainLayout from "@/layouts/MainLayout";

// Pages
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Editor from "@/pages/Editor";
import Components from "@/pages/Components";

// Context
import { ComponentProvider } from "@/context/ComponentContext";

const useAuth = () => {
  const token = localStorage.getItem("access_token");
  const user = { loggedIn: !!token };

  return user.loggedIn;
};

const ProtectedRoutes = () => {
  const isAuth = useAuth();

  return isAuth ? <Outlet /> : <Navigate to="/login" />;
};

function App() {
  return (
    <ComponentProvider>
      <Routes>
        {/* Public Routes */}
        <Route element={<Login />} path="/login" />
        <Route element={<Register />} path="/register" />

        {/* Protected Routes */}
        <Route element={<ProtectedRoutes />}>
          {/* Main Layout */}
          <Route element={<MainLayout />}>
            <Route element={<Navigate replace to="/dashboard" />} path="/" />
            <Route element={<Dashboard />} path="/dashboard" />
            <Route element={<Components />} path="/components" />
          </Route>

          {/* Editor Layout */}
          <Route element={<Editor />} path="/editor/:projectId" />
        </Route>

        {/* Other Routes */}
        {/* <Route path="/reports" element={<ReportsPage />} /> */}
      </Routes>
    </ComponentProvider>
  );
}

export default App;
