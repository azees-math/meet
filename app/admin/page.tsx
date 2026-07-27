"use client";

import * as React from "react";
import { Download, Filter, KeyRound, Pencil, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { AdminSidebar } from "@/components/admin-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  AUTH_SESSION_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  AuthSessionState,
  AuthUser,
} from "@/lib/auth-session";

type AdminUser = {
  username: string;
  userType: "admin" | "user";
  first_name: string;
  last_name: string;
  email: string;
  phoneno: string;
  createdAt: string;
  updatedAt: string;
};

type MeetingRoom = {
  roomName: string;
  meetType: "public" | "private";
  createdAt: string;
  updatedAt: string;
};

type MeetingRoomAccessLog = {
  id: string;
  roomName: string;
  participantName: string;
  accessType: "guest" | "authenticated";
  username: string | null;
  userType: "admin" | "user" | null;
  createdAt: string;
};

type OnlineUser = {
  sessionId: string;
  username: string;
  userType: "admin" | "user";
  authMethod: "google" | "password";
  startedAt: string;
  lastSeenAt: string;
};

type ActivityLog = {
  id: string;
  sessionId: string;
  username: string;
  userType: "admin" | "user";
  activityType: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

type PaginatedResponse<T> = T & {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const ADMIN_TABS = [
  { key: "users", label: "Users" },
  { key: "rooms", label: "Meeting Rooms" },
  { key: "online", label: "Online Users" },
  { key: "logs", label: "Activity Logs" },
] as const;
const PAGE_SIZE = 10;

type AdminTab = (typeof ADMIN_TABS)[number]["key"];

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as { error?: string; [key: string]: unknown };
  }

  const text = await response.text();
  return {
    error: text.startsWith("<!DOCTYPE") ? "The server returned an unexpected HTML error page." : text,
  };
}

function formatActivityDetails(details: Record<string, unknown> | null) {
  if (!details) {
    return "-";
  }

  const authMethod = typeof details.authMethod === "string" ? details.authMethod : null;
  const reason = typeof details.reason === "string" ? details.reason : null;

  if (authMethod && reason) {
    return `${authMethod} • ${reason}`;
  }

  if (authMethod) {
    return authMethod;
  }

  if (reason) {
    return reason;
  }

  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

function PaginationControls(props: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, total, onPageChange } = props;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
      <p className="text-sm text-zinc-400">
        Page {page} of {totalPages} • {total} items
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
  const [authSession, setAuthSession] = React.useState<AuthSessionState | null>(null);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [meetingRooms, setMeetingRooms] = React.useState<MeetingRoom[]>([]);
  const [meetingRoomAccessLogs, setMeetingRoomAccessLogs] = React.useState<MeetingRoomAccessLog[]>([]);
  const [onlineUsers, setOnlineUsers] = React.useState<OnlineUser[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<ActivityLog[]>([]);
  const [usersPage, setUsersPage] = React.useState(1);
  const [meetingRoomsPage, setMeetingRoomsPage] = React.useState(1);
  const [meetingRoomAccessPage, setMeetingRoomAccessPage] = React.useState(1);
  const [onlineUsersPage, setOnlineUsersPage] = React.useState(1);
  const [activityLogsPage, setActivityLogsPage] = React.useState(1);
  const [usersTotalPages, setUsersTotalPages] = React.useState(1);
  const [meetingRoomsTotalPages, setMeetingRoomsTotalPages] = React.useState(1);
  const [meetingRoomAccessTotalPages, setMeetingRoomAccessTotalPages] = React.useState(1);
  const [onlineUsersTotalPages, setOnlineUsersTotalPages] = React.useState(1);
  const [activityLogsTotalPages, setActivityLogsTotalPages] = React.useState(1);
  const [usersTotal, setUsersTotal] = React.useState(0);
  const [meetingRoomsTotal, setMeetingRoomsTotal] = React.useState(0);
  const [meetingRoomAccessTotal, setMeetingRoomAccessTotal] = React.useState(0);
  const [onlineUsersTotal, setOnlineUsersTotal] = React.useState(0);
  const [activityLogsTotal, setActivityLogsTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = React.useState<AdminUser | null>(null);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = React.useState(true);
  const [isLoadingMeetingRooms, setIsLoadingMeetingRooms] = React.useState(true);
  const [isLoadingMeetingRoomAccessLogs, setIsLoadingMeetingRoomAccessLogs] = React.useState(true);
  const [isLoadingOnlineUsers, setIsLoadingOnlineUsers] = React.useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<AdminTab>("users");
  const [meetingRoomAccessFilter, setMeetingRoomAccessFilter] = React.useState("");

  React.useEffect(() => {
    const syncTabFromLocation = () => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "online" || tab === "logs" || tab === "users" || tab === "rooms") {
        setActiveTab(tab);
        return;
      }
      setActiveTab("users");
    };

    syncTabFromLocation();
    window.addEventListener("popstate", syncTabFromLocation);

    return () => {
      window.removeEventListener("popstate", syncTabFromLocation);
    };
  }, []);

  const setTab = React.useCallback(
    (tab: AdminTab) => {
      setActiveTab(tab);
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("tab", tab);
      router.replace(`/admin?${nextParams.toString()}`);
    },
    [router],
  );

  const loadUsers = React.useCallback(async (sessionId: string, page = 1) => {
    setIsLoadingUsers(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: {
          "x-session-id": sessionId,
        },
      });
      const result = (await response.json()) as PaginatedResponse<{ users: AdminUser[] }> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load users.");
      }
      setUsers(result.users);
      setSelectedUserProfile((current) =>
        current ? result.users.find((user) => user.username === current.username) ?? current : result.users[0] ?? null,
      );
      setUsersPage(result.page);
      setUsersTotalPages(result.totalPages);
      setUsersTotal(result.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const loadMeetingRooms = React.useCallback(async (sessionId: string, page = 1) => {
    setIsLoadingMeetingRooms(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/meeting-rooms?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: {
          "x-session-id": sessionId,
        },
      });
      const result = (await response.json()) as PaginatedResponse<{ rooms: MeetingRoom[] }> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load meeting rooms.");
      }
      setMeetingRooms(result.rooms);
      setMeetingRoomsPage(result.page);
      setMeetingRoomsTotalPages(result.totalPages);
      setMeetingRoomsTotal(result.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load meeting rooms.");
    } finally {
      setIsLoadingMeetingRooms(false);
    }
  }, []);

  const loadMeetingRoomAccessLogs = React.useCallback(
    async (sessionId: string, page = 1, roomName?: string) => {
      setIsLoadingMeetingRoomAccessLogs(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        if (roomName?.trim()) {
          params.set("roomName", roomName.trim());
        }

        const response = await fetch(`/api/admin/meeting-room-access?${params.toString()}`, {
          headers: {
            "x-session-id": sessionId,
          },
        });
        const result = (await response.json()) as PaginatedResponse<{ logs: MeetingRoomAccessLog[] }> & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load meeting room access logs.");
        }
        setMeetingRoomAccessLogs(result.logs);
        setMeetingRoomAccessPage(result.page);
        setMeetingRoomAccessTotalPages(result.totalPages);
        setMeetingRoomAccessTotal(result.total);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load meeting room access logs.",
        );
      } finally {
        setIsLoadingMeetingRoomAccessLogs(false);
      }
    },
    [],
  );

  const loadOnlineUsers = React.useCallback(async (sessionId: string, page = 1) => {
    setIsLoadingOnlineUsers(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/online-users?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: {
          "x-session-id": sessionId,
        },
      });
      const result = (await response.json()) as PaginatedResponse<{ onlineUsers: OnlineUser[] }> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load online users.");
      }
      setOnlineUsers(result.onlineUsers);
      setOnlineUsersPage(result.page);
      setOnlineUsersTotalPages(result.totalPages);
      setOnlineUsersTotal(result.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load online users.");
    } finally {
      setIsLoadingOnlineUsers(false);
    }
  }, []);

  const loadActivityLogs = React.useCallback(async (sessionId: string, page = 1) => {
    setIsLoadingLogs(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/activity-logs?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: {
          "x-session-id": sessionId,
        },
      });
      const result = (await response.json()) as PaginatedResponse<{ logs: ActivityLog[] }> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load activity logs.");
      }
      setActivityLogs(result.logs);
      setActivityLogsPage(result.page);
      setActivityLogsTotalPages(result.totalPages);
      setActivityLogsTotal(result.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load activity logs.");
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  React.useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const storedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!storedUser || !storedSession) {
      router.replace("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as AuthUser;
      const parsedSession = JSON.parse(storedSession) as AuthSessionState;

      if (parsedUser.userType !== "admin") {
        router.replace("/");
        return;
      }

      setAuthUser(parsedUser);
      setAuthSession(parsedSession);
      void loadUsers(parsedSession.sessionId, 1);
      void loadMeetingRooms(parsedSession.sessionId, 1);
      void loadMeetingRoomAccessLogs(parsedSession.sessionId, 1);
      void loadOnlineUsers(parsedSession.sessionId, 1);
      void loadActivityLogs(parsedSession.sessionId, 1);
    } catch {
      router.replace("/");
      return;
    }

    setIsReady(true);
  }, [loadActivityLogs, loadMeetingRoomAccessLogs, loadMeetingRooms, loadOnlineUsers, loadUsers, router]);

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      userType: String(formData.get("userType") ?? "user"),
      first_name: String(formData.get("first_name") ?? ""),
      last_name: String(formData.get("last_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phoneno: String(formData.get("phoneno") ?? ""),
    };

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to create user.");
      }
      event.currentTarget.reset();
      await loadUsers(authSession.sessionId, 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateUserType(username: string, userType: "admin" | "user") {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify({ userType }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update user type.");
      }
      await loadUsers(authSession.sessionId, usersPage);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user type.");
    }
  }

  async function handleUpdateUserProfile(event: React.FormEvent<HTMLFormElement>) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    if (!selectedUserProfile) {
      setError("Select a user first.");
      return;
    }

    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const first_name = String(formData.get("first_name") ?? "");
    const last_name = String(formData.get("last_name") ?? "");
    const email = String(formData.get("email") ?? "");
    const phoneno = String(formData.get("phoneno") ?? "");

    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(selectedUserProfile.username)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify({ first_name, last_name, email, phoneno }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update user profile.");
      }
      await loadUsers(authSession.sessionId, usersPage);
      setIsUserProfileModalOpen(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user profile.");
    }
  }

  async function handleCreateMeetingRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      roomName: String(formData.get("roomName") ?? ""),
      password: String(formData.get("password") ?? ""),
      meetType: String(formData.get("meetType") ?? "private"),
    };

    try {
      const response = await fetch("/api/admin/meeting-rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to create meeting room.");
      }
      event.currentTarget.reset();
      await loadMeetingRooms(authSession.sessionId, 1);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to create meeting room.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetMeetingRoomPassword(roomName: string) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const password = window.prompt(`Set new password for ${roomName}`);
    if (!password) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/meeting-rooms`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify({ roomName, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to reset meeting room password.");
      }
      await loadMeetingRooms(authSession.sessionId, meetingRoomsPage);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset meeting room password.",
      );
    }
  }

  async function handleUpdateMeetingType(roomName: string, meetType: "public" | "private") {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/meeting-rooms`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify({ roomName, meetType }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update meeting type.");
      }
      await loadMeetingRooms(authSession.sessionId, meetingRoomsPage);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update meeting type.");
    }
  }

  async function handleDeleteMeetingRoom(roomName: string) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const confirmed = window.confirm(`Delete meeting room ${roomName}?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/meeting-rooms`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify({ roomName }),
      });
      const result = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete meeting room.");
      }

      const nextPage =
        meetingRooms.length === 1 && meetingRoomsPage > 1 ? meetingRoomsPage - 1 : meetingRoomsPage;
      await loadMeetingRooms(authSession.sessionId, nextPage);
      await loadMeetingRoomAccessLogs(authSession.sessionId, 1, meetingRoomAccessFilter);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete meeting room.",
      );
    }
  }

  async function handleResetPassword(username: string) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const password = window.prompt(`Set new password for ${username}`);
    if (!password) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": authSession.sessionId,
        },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to reset password.");
      }
      await loadUsers(authSession.sessionId, usersPage);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset password.");
    }
  }

  async function handleDeleteUser(username: string) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const confirmed = window.confirm(`Delete user ${username}?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: {
          "x-session-id": authSession.sessionId,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete user.");
      }

      const nextUsersPage = users.length === 1 && usersPage > 1 ? usersPage - 1 : usersPage;
      await loadUsers(authSession.sessionId, nextUsersPage);
      await loadOnlineUsers(authSession.sessionId, onlineUsersPage);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete user.");
    }
  }

  async function handleDeleteActivityLog(id: string) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const confirmed = window.confirm("Delete this activity log?");
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/activity-logs/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "x-session-id": authSession.sessionId,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete activity log.");
      }

      const nextPage =
        activityLogs.length === 1 && activityLogsPage > 1 ? activityLogsPage - 1 : activityLogsPage;
      await loadActivityLogs(authSession.sessionId, nextPage);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete activity log.");
    }
  }

  async function handleClearActivityLogs() {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const confirmed = window.confirm("Delete all activity logs?");
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const response = await fetch("/api/admin/activity-logs", {
        method: "DELETE",
        headers: {
          "x-session-id": authSession.sessionId,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to clear activity logs.");
      }
      await loadActivityLogs(authSession.sessionId, 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to clear activity logs.");
    }
  }

  async function handleEndOnlineSession(sessionId: string) {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    const confirmed = window.confirm("End this online session?");
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/admin/online-users/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: {
          "x-session-id": authSession.sessionId,
        },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to end online session.");
      }

      const nextPage =
        onlineUsers.length === 1 && onlineUsersPage > 1 ? onlineUsersPage - 1 : onlineUsersPage;
      await loadOnlineUsers(authSession.sessionId, nextPage);
      await loadActivityLogs(authSession.sessionId, 1);
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Unable to end online session.");
    }
  }

  async function handleExportMeetingRoomAccessCsv() {
    if (!authSession) {
      setError("Admin session is missing.");
      return;
    }

    setError(null);
    try {
      const params = new URLSearchParams();
      if (meetingRoomAccessFilter.trim()) {
        params.set("roomName", meetingRoomAccessFilter.trim());
      }

      const response = await fetch(
        `/api/admin/meeting-room-access/export${params.toString() ? `?${params.toString()}` : ""}`,
        {
          headers: {
            "x-session-id": authSession.sessionId,
          },
        },
      );

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Unable to export meeting room access logs.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = meetingRoomAccessFilter.trim()
        ? `meeting-room-access-${meetingRoomAccessFilter.trim()}.csv`
        : "meeting-room-access.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export meeting room access logs.",
      );
    }
  }

  async function handleSignOut() {
    try {
      const storedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession) as AuthSessionState;
          await fetch("/api/auth/session/end", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionId: session.sessionId, reason: "manual_logout" }),
            keepalive: true,
          });
        } catch {
          window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        }
      }
    } finally {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      setAuthUser(null);
      setAuthSession(null);
      router.replace("/login");
    }
  }

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <p className="text-sm text-zinc-400">Loading</p>
      </main>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <AdminSidebar
        authUser={authUser}
        activeTab={activeTab}
        onSelectTab={setTab}
        onSignOut={() => {
          void handleSignOut();
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-zinc-950/90 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-sm font-semibold text-white">
                {ADMIN_TABS.find((tab) => tab.key === activeTab)?.label}
              </h1>
              <p className="text-xs text-zinc-400">
                {activeTab === "users"
                  ? "Manage accounts, roles, and credentials."
                  : activeTab === "rooms"
                    ? "Manage meeting rooms and room passwords."
                  : activeTab === "online"
                    ? "Track active sessions and online users."
                    : "Review login and logout history."}
              </p>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {activeTab === "users" ? (
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <form
                onSubmit={handleCreateUser}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-white">New User</h2>
                  <p className="mt-1 text-sm text-zinc-400">Only admin can create new users.</p>
                </div>
                <div className="space-y-3">
                  <input
                    name="username"
                    type="text"
                    placeholder="Username"
                    required
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <input
                    name="first_name"
                    type="text"
                    placeholder="First name"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <input
                    name="last_name"
                    type="text"
                    placeholder="Last name"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <input
                    name="phoneno"
                    type="text"
                    placeholder="Phone number"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <select
                    name="userType"
                    defaultValue="user"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>

              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-white">User List</h2>
                  <p className="mt-1 text-sm text-zinc-400">Current users in database.</p>
                </div>
                {isLoadingUsers ? (
                  <p className="text-sm text-zinc-400">Loading users...</p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-zinc-400">No users found.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[minmax(120px,1fr)_minmax(220px,1.2fr)_120px_minmax(160px,1fr)_260px] gap-3 border-b border-white/10 pb-2 text-xs uppercase tracking-wide text-zinc-500">
                      <span>Username</span>
                      <span>Profile</span>
                      <span>Type</span>
                      <span>Updated</span>
                      <span>Actions</span>
                    </div>
                    {users.map((user) => (
                      <div
                        key={user.username}
                        className="grid grid-cols-[minmax(120px,1fr)_minmax(220px,1.2fr)_120px_minmax(160px,1fr)_260px] items-center gap-3 border-b border-white/8 py-3"
                      >
                        <span className="text-sm text-white">{user.username}</span>
                        <div className="min-w-0 text-sm text-zinc-300">
                          <div className="truncate text-white">
                            {[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}
                          </div>
                          <div className="truncate text-zinc-400">{user.email || "-"}</div>
                          <div className="truncate text-zinc-500">{user.phoneno || "-"}</div>
                        </div>
                        <select
                          value={user.userType}
                          onChange={(event) =>
                            void handleUpdateUserType(
                              user.username,
                              event.target.value as "admin" | "user",
                            )
                          }
                          className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white outline-none"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <span className="text-sm text-zinc-400">
                          {new Date(user.updatedAt).toLocaleString()}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Edit profile"
                            aria-label="Edit profile"
                            onClick={() => {
                              setSelectedUserProfile(user);
                              setIsUserProfileModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit profile</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Reset password"
                            aria-label="Reset password"
                            onClick={() => void handleResetPassword(user.username)}
                          >
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Reset password</span>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            title="Delete user"
                            aria-label="Delete user"
                            onClick={() => void handleDeleteUser(user.username)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete user</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                    <PaginationControls
                      page={usersPage}
                      totalPages={usersTotalPages}
                      total={usersTotal}
                      onPageChange={(page) => {
                        if (authSession) {
                          void loadUsers(authSession.sessionId, page);
                        }
                      }}
                    />
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "rooms" ? (
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <form
                onSubmit={handleCreateMeetingRoom}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-white">New Meeting Room</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Create meeting rooms for guest access with password.
                  </p>
                </div>
                <div className="space-y-3">
                  <input
                    name="roomName"
                    type="text"
                    placeholder="meeting-room-11"
                    required
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Room password"
                    required
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                  />
                  <select
                    name="meetType"
                    defaultValue="private"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Meeting Room"}
                  </Button>
                </div>
              </form>

              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-white">Meeting Room List</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Room IDs and password management for guest access.
                  </p>
                </div>
                {isLoadingMeetingRooms ? (
                  <p className="text-sm text-zinc-400">Loading meeting rooms...</p>
                ) : meetingRooms.length === 0 ? (
                  <p className="text-sm text-zinc-400">No meeting rooms found.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[minmax(160px,1fr)_120px_minmax(160px,1fr)_220px] gap-3 border-b border-white/10 pb-2 text-xs uppercase tracking-wide text-zinc-500">
                      <span>Meeting Room</span>
                      <span>Type</span>
                      <span>Updated</span>
                      <span>Actions</span>
                    </div>
                    {meetingRooms.map((room) => (
                      <div
                        key={room.roomName}
                        className="grid grid-cols-[minmax(160px,1fr)_120px_minmax(160px,1fr)_220px] items-center gap-3 border-b border-white/8 py-3"
                      >
                        <span className="text-sm text-white">{room.roomName}</span>
                        <select
                          value={room.meetType}
                          onChange={(event) =>
                            void handleUpdateMeetingType(
                              room.roomName,
                              event.target.value as "public" | "private",
                            )
                          }
                          className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white outline-none"
                        >
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                        </select>
                        <span className="text-sm text-zinc-400">
                          {new Date(room.updatedAt).toLocaleString()}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Reset password"
                            aria-label="Reset password"
                            onClick={() => void handleResetMeetingRoomPassword(room.roomName)}
                          >
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Reset password</span>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            title="Delete meeting room"
                            aria-label="Delete meeting room"
                            onClick={() => void handleDeleteMeetingRoom(room.roomName)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete meeting room</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                    <PaginationControls
                      page={meetingRoomsPage}
                      totalPages={meetingRoomsTotalPages}
                      total={meetingRoomsTotal}
                      onPageChange={(page) => {
                        if (authSession) {
                          void loadMeetingRooms(authSession.sessionId, page);
                        }
                      }}
                    />
                  </div>
                )}
              </section>

              <section className="xl:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">Room Access History</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      Track who joined a meeting room and how access was granted.
                    </p>
                  </div>
                  <form
                    className="flex w-full max-w-md gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (authSession) {
                        void loadMeetingRoomAccessLogs(
                          authSession.sessionId,
                          1,
                          meetingRoomAccessFilter,
                        );
                      }
                    }}
                  >
                    <input
                      type="text"
                      value={meetingRoomAccessFilter}
                      onChange={(event) => setMeetingRoomAccessFilter(event.target.value)}
                      placeholder="Filter by room name"
                      className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                    />
                    <Button type="submit" variant="outline" size="sm">
                      <Filter className="h-4 w-4" />
                      <span className="sr-only">Filter</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Export CSV"
                      aria-label="Export CSV"
                      onClick={() => void handleExportMeetingRoomAccessCsv()}
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Export CSV</span>
                    </Button>
                  </form>
                </div>
                {isLoadingMeetingRoomAccessLogs ? (
                  <p className="text-sm text-zinc-400">Loading meeting room access logs...</p>
                ) : meetingRoomAccessLogs.length === 0 ? (
                  <p className="text-sm text-zinc-400">No meeting room access logs found.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-auto">
                      <div className="grid min-w-[860px] grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_120px_minmax(120px,1fr)_100px_minmax(160px,1fr)] gap-3 border-b border-white/10 pb-2 text-xs uppercase tracking-wide text-zinc-500">
                        <span>When</span>
                        <span>Meeting Room</span>
                        <span>Access</span>
                        <span>Participant</span>
                        <span>User Type</span>
                        <span>Account</span>
                      </div>
                      {meetingRoomAccessLogs.map((log) => (
                        <div
                          key={log.id}
                          className="grid min-w-[860px] grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_120px_minmax(120px,1fr)_100px_minmax(160px,1fr)] gap-3 border-b border-white/8 py-3"
                        >
                          <span className="text-sm text-zinc-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                          <span className="text-sm text-white">{log.roomName}</span>
                          <span className="text-sm capitalize text-zinc-300">{log.accessType}</span>
                          <span className="text-sm text-zinc-300">{log.participantName}</span>
                          <span className="text-sm text-zinc-300">{log.userType ?? "-"}</span>
                          <span className="text-sm text-zinc-400">{log.username ?? "-"}</span>
                        </div>
                      ))}
                    </div>
                    <PaginationControls
                      page={meetingRoomAccessPage}
                      totalPages={meetingRoomAccessTotalPages}
                      total={meetingRoomAccessTotal}
                      onPageChange={(page) => {
                        if (authSession) {
                          void loadMeetingRoomAccessLogs(
                            authSession.sessionId,
                            page,
                            meetingRoomAccessFilter,
                          );
                        }
                      }}
                    />
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "online" ? (
            <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">Online Users</h2>
                <p className="mt-1 text-sm text-zinc-400">Current active sessions.</p>
              </div>
              {isLoadingOnlineUsers ? (
                <p className="text-sm text-zinc-400">Loading online users...</p>
              ) : onlineUsers.length === 0 ? (
                <p className="text-sm text-zinc-400">No active sessions.</p>
              ) : (
                <>
                  <div className="min-h-0 overflow-auto space-y-3">
                    <div className="grid grid-cols-[minmax(120px,1fr)_100px_100px_minmax(160px,1fr)_minmax(160px,1fr)_120px] gap-3 border-b border-white/10 pb-2 text-xs uppercase tracking-wide text-zinc-500">
                      <span>Username</span>
                      <span>Type</span>
                      <span>Method</span>
                      <span>Started</span>
                      <span>Last Seen</span>
                      <span>Action</span>
                    </div>
                    {onlineUsers.map((user) => (
                      <div
                        key={user.sessionId}
                        className="grid grid-cols-[minmax(120px,1fr)_100px_100px_minmax(160px,1fr)_minmax(160px,1fr)_120px] items-center gap-3 border-b border-white/8 py-3"
                      >
                        <span className="text-sm text-white">{user.username}</span>
                        <span className="text-sm text-zinc-300">{user.userType}</span>
                        <span className="text-sm text-zinc-300">{user.authMethod}</span>
                        <span className="text-sm text-zinc-400">
                          {new Date(user.startedAt).toLocaleString()}
                        </span>
                        <span className="text-sm text-zinc-400">
                          {new Date(user.lastSeenAt).toLocaleString()}
                        </span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          title="End session"
                          aria-label="End session"
                          disabled={authSession?.sessionId === user.sessionId}
                          onClick={() => void handleEndOnlineSession(user.sessionId)}
                        >
                          <Power className="h-4 w-4" />
                          <span className="sr-only">End session</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                  <PaginationControls
                    page={onlineUsersPage}
                    totalPages={onlineUsersTotalPages}
                    total={onlineUsersTotal}
                    onPageChange={(page) => {
                      if (authSession) {
                        void loadOnlineUsers(authSession.sessionId, page);
                      }
                    }}
                  />
                </>
              )}
            </section>
          ) : null}

          {activeTab === "logs" ? (
            <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Activity Logs</h2>
                  <p className="mt-1 text-sm text-zinc-400">Latest login and logout records.</p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  title="Clear logs"
                  aria-label="Clear logs"
                  onClick={() => void handleClearActivityLogs()}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Clear logs</span>
                </Button>
              </div>
              {isLoadingLogs ? (
                <p className="text-sm text-zinc-400">Loading activity logs...</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-sm text-zinc-400">No activity logs found.</p>
              ) : (
                <>
                  <div className="min-h-0 overflow-auto space-y-3">
                    <div className="grid grid-cols-[minmax(160px,1fr)_minmax(120px,0.8fr)_100px_100px_minmax(140px,1fr)_minmax(220px,1.4fr)_100px] gap-3 border-b border-white/10 pb-2 text-xs uppercase tracking-wide text-zinc-500">
                      <span>When</span>
                      <span>Username</span>
                      <span>Type</span>
                      <span>Activity</span>
                      <span>Details</span>
                      <span>Session</span>
                      <span>Action</span>
                    </div>
                    {activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="grid grid-cols-[minmax(160px,1fr)_minmax(120px,0.8fr)_100px_100px_minmax(140px,1fr)_minmax(220px,1.4fr)_100px] items-center gap-3 border-b border-white/8 py-3"
                      >
                        <span className="text-sm text-zinc-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <span className="text-sm text-white">{log.username}</span>
                        <span className="text-sm text-zinc-300">{log.userType}</span>
                        <span className="text-sm text-zinc-300">{log.activityType}</span>
                        <span className="text-sm text-zinc-400">{formatActivityDetails(log.details)}</span>
                        <span className="truncate text-sm text-zinc-500">{log.sessionId}</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          title="Delete activity log"
                          aria-label="Delete activity log"
                          onClick={() => void handleDeleteActivityLog(log.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete activity log</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                  <PaginationControls
                    page={activityLogsPage}
                    totalPages={activityLogsTotalPages}
                    total={activityLogsTotal}
                    onPageChange={(page) => {
                      if (authSession) {
                        void loadActivityLogs(authSession.sessionId, page);
                      }
                    }}
                  />
                </>
              )}
            </section>
          ) : null}
        </div>
        {isUserProfileModalOpen && selectedUserProfile ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form
              onSubmit={handleUpdateUserProfile}
              className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Edit User Profile</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Editing {selectedUserProfile.username}.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUserProfileModalOpen(false)}
                >
                  Close
                </Button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={selectedUserProfile.username}
                  disabled
                  className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-zinc-400 outline-none ring-0"
                />
                <input
                  name="first_name"
                  type="text"
                  defaultValue={selectedUserProfile.first_name}
                  key={`first_name:${selectedUserProfile.username}:${selectedUserProfile.updatedAt}`}
                  placeholder="First name"
                  className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                />
                <input
                  name="last_name"
                  type="text"
                  defaultValue={selectedUserProfile.last_name}
                  key={`last_name:${selectedUserProfile.username}:${selectedUserProfile.updatedAt}`}
                  placeholder="Last name"
                  className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                />
                <input
                  name="email"
                  type="email"
                  defaultValue={selectedUserProfile.email}
                  key={`email:${selectedUserProfile.username}:${selectedUserProfile.updatedAt}`}
                  placeholder="Email"
                  className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                />
                <input
                  name="phoneno"
                  type="text"
                  defaultValue={selectedUserProfile.phoneno}
                  key={`phoneno:${selectedUserProfile.username}:${selectedUserProfile.updatedAt}`}
                  placeholder="Phone number"
                  className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500"
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  Save Profile
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}
