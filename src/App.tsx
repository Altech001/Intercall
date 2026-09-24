import { createBrowserRouter, RouterProvider } from "react-router"
import { ChatWidget } from "@/components/chat-widget"
import { Landing } from "@/pages/landing"
import { Assistant } from "@/pages/dashboard/assistant"
import { DashboardLayout } from "@/pages/dashboard/layout"
import { CustomersPage } from "@/pages/dashboard/customers"
import { SettingsPage } from "@/pages/dashboard/settings"
import { TicketView } from "@/pages/dashboard/ticket"

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  // Loaded inside an iframe by public/widget.js on customer sites.
  { path: "/embed", element: <ChatWidget embedded /> },
  {
    path: "/dashboard",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Assistant /> },
      { path: "t/:id", element: <TicketView /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}

export default App
