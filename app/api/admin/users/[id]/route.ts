// DELETE /api/admin/users/[id] - Delete admin user
import { NextRequest, NextResponse } from 'next/server';
import { deleteAdminUser, getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// DELETE - Delete admin user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    await deleteAdminUser(id, authUser.userId);
    
    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
