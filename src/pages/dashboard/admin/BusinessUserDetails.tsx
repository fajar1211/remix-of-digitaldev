import { useParams } from "react-router-dom";

import ClientList from "../assist/ClientList";

export default function AdminBusinessUserDetails() {
  const { userId } = useParams();

  if (!userId) return null;

  return (
    <ClientList
      initialClientId={userId}
      backTo="/dashboard/admin/business-users"
      hideClientList
      allowInactive
    />
  );
}
