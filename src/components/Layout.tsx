import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { 
  LayoutDashboard, 
  FolderKanban,
  Bell,
  Mail,
  Search,
  User,
  Settings,
  List,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Project Profile", href: "/projects", icon: FolderKanban },
];

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-56 transition-transform duration-300 ease-in-out lg:translate-x-0",
        "bg-gradient-to-b from-[#2c354f] to-[#1a1f2e]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <Link 
            href="/"
            className="flex items-center justify-center h-16 px-4 border-b border-white/10"
          >
            <div className="text-center">
              <span className="text-xl font-bold text-white">THEA-X</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden absolute right-2 text-white hover:bg-white/10"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </Link>

          {/* Divider */}
          <hr className="border-white/10 my-0" />

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href || 
                  (item.href === "/projects" && router.pathname.startsWith("/bom"));
                
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-56">
        {/* Top navbar */}
        <nav className="bg-white shadow-sm border-b sticky top-0 z-30">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                
                {/* Search bar - hidden on mobile */}
                <div className="hidden sm:flex items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search for ..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2c354f] focus:border-transparent w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Mobile search */}
                <Button variant="ghost" size="icon" className="sm:hidden">
                  <Search className="h-5 w-5" />
                </Button>

                {/* Notifications */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                  >
                    <Bell className="h-5 w-5" />
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      3
                    </Badge>
                  </Button>
                  
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border overflow-hidden">
                      <div className="px-4 py-3 border-b bg-gray-50">
                        <h6 className="text-sm font-semibold text-gray-700 uppercase">Alerts Center</h6>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <a href="#" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b">
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">📄</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 mb-1">December 12, 2019</p>
                            <p className="text-sm text-gray-700">A new monthly report is ready to download!</p>
                          </div>
                        </a>
                        <a href="#" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b">
                          <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">💰</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 mb-1">December 7, 2019</p>
                            <p className="text-sm text-gray-700">$290.29 has been deposited into your account!</p>
                          </div>
                        </a>
                      </div>
                      <a href="#" className="block px-4 py-2 text-center text-sm text-gray-500 hover:bg-gray-50 border-t">
                        Show All Alerts
                      </a>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setMessagesOpen(!messagesOpen)}
                  >
                    <Mail className="h-5 w-5" />
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      7
                    </Badge>
                  </Button>
                  
                  {messagesOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border overflow-hidden">
                      <div className="px-4 py-3 border-b bg-gray-50">
                        <h6 className="text-sm font-semibold text-gray-700 uppercase">Messages</h6>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <a href="#" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b">
                          <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-700 truncate">Hi there! I am wondering if you can help me...</p>
                            <p className="text-xs text-gray-500">Emily Fowler - 58m</p>
                          </div>
                        </a>
                        <a href="#" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b">
                          <div className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-700 truncate">I have the photos that you ordered last month!</p>
                            <p className="text-xs text-gray-500">Jae Chun - 1d</p>
                          </div>
                        </a>
                      </div>
                      <a href="#" className="block px-4 py-2 text-center text-sm text-gray-500 hover:bg-gray-50 border-t">
                        Show All Messages
                      </a>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-8 bg-gray-300"></div>

                {/* User profile */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
                  >
                    <span className="hidden lg:inline text-sm text-gray-600">Maningas Construction</span>
                    <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-gray-200"></div>
                  </button>
                  
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border overflow-hidden">
                      <a href="#" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Profile</span>
                      </a>
                      <a href="#" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                        <Settings className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Settings</span>
                      </a>
                      <a href="#" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                        <List className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Activity log</span>
                      </a>
                      <div className="border-t"></div>
                      <a href="#" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                        <LogOut className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">Logout</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}