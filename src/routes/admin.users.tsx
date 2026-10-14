import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/users")({
  component: function AdminUsersGone() {
    return <Navigate to="/admin" />;
  },
});
