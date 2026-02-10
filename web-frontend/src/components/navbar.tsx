import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import {
  Popover,
  PopoverTrigger,
  Avatar,
  PopoverContent,
  User,
  Divider,
} from "@heroui/react";
import { useLocation, useNavigate } from "react-router-dom";

import { logoutUser } from "../api/auth";
import { ThemeSwitch } from "./theme-switch";
export const CNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username") || "Guest";

  return (
    <>
      <Navbar
        classNames={{
          base: "bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800",
          wrapper: "px-6",
        }}
        isBordered={false}
        maxWidth="full"
        position="sticky"
      >
        <NavbarBrand
          className="cursor-pointer gap-3 hover:opacity-80 transition-opacity"
          onClick={() => navigate("/dashboard")}
        >
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
            <p className="text-white text-xl">🧪</p>
          </div>
          <div className="flex flex-col">
            <p className="font-bold text-inherit text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ChemPFD
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Process Flow Designer</p>
          </div>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-2" justify="center">
          <NavbarItem isActive={location.pathname === "/dashboard"}>
            <Link
              color={location.pathname === "/dashboard" ? "primary" : "foreground"}
              href="/dashboard"
              className={`px-4 py-2 rounded-lg transition-all ${location.pathname === "/dashboard"
                ? "bg-blue-100 dark:bg-blue-900/30 font-semibold"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
            >
              Dashboard
            </Link>
          </NavbarItem>
          <NavbarItem isActive={location.pathname === "/components"}>
            <Link
              color={location.pathname === "/components" ? "primary" : "foreground"}
              href="/components"
              className={`px-4 py-2 rounded-lg transition-all ${location.pathname === "/components"
                ? "bg-blue-100 dark:bg-blue-900/30 font-semibold"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
            >
              Components DB
            </Link>
          </NavbarItem>
        </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            <ThemeSwitch />
          </NavbarItem>
          <NavbarItem>
            {/* Profile Popover */}
            <Popover placement="bottom-end" showArrow={true}>
              <PopoverTrigger>
                <Avatar
                  isBordered
                  as="button"
                  className="transition-transform hover:scale-110"
                  color="primary"
                  name={username[0]?.toUpperCase() || "U"}
                  size="sm"
                  src=""
                />
              </PopoverTrigger>
              <PopoverContent className="p-1 w-60">
                <div className="px-1 py-2 w-full">
                  <User
                    avatarProps={{
                      src: "",
                      name: username[0]?.toUpperCase() || "U",
                      isBordered: true,
                      color: "primary"
                    }}
                    classNames={{
                      base: "gap-3",
                      name: "text-default-800 font-semibold",
                      description: "text-default-500",
                    }}
                    description="Professional Edition"
                    name={username}
                  />
                </div>
                <Divider />
                <div className="flex flex-col gap-1 p-1">
                  <Button
                    className="justify-start hover:bg-gray-100 dark:hover:bg-gray-800"
                    size="sm"
                    variant="light"
                  >
                    My Settings
                  </Button>
                  <Button
                    className="justify-start hover:bg-gray-100 dark:hover:bg-gray-800"
                    size="sm"
                    variant="light"
                  >
                    Help & Feedback
                  </Button>
                  <Divider className="my-1" />
                  <Button
                    className="justify-start"
                    color="danger"
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      logoutUser();
                      navigate("/login");
                    }}
                  >
                    Log Out
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </NavbarItem>
        </NavbarContent>
      </Navbar>
    </>
  );
};
