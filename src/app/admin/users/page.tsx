import prisma from "@/lib/prisma";
import { deleteUser } from "@/app/actions/admin";
import UserRoleSelect from "@/components/admin/UserRoleSelect";

export default async function AdminUsersPage() {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div>
            <h1 className="page-title mb-8">계정 관리</h1>

            <div className="card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-secondary/20 border-b">
                            <th className="p-4 text-xs font-bold">이름/이메일</th>
                            <th className="p-4 text-xs font-bold">권한</th>
                            <th className="p-4 text-xs font-bold text-right">작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="border-b last:border-0 hover:bg-secondary/5">
                                <td className="p-4">
                                    <div className="font-bold">{user.name}</div>
                                    <div className="text-xs text-secondary-foreground">{user.email}</div>
                                </td>
                                <td className="p-4">
                                    <UserRoleSelect userId={user.id} initialRole={user.role} />
                                </td>
                                <td className="p-4 text-right">
                                    {user.email !== 'sangdy85' && (
                                        <form action={deleteUser.bind(null, user.id)}>
                                            <button className="text-destructive text-xs hover:underline">삭제</button>
                                        </form>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
