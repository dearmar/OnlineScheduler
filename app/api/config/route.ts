// GET/PUT /api/config - Scheduler configuration
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/lib/storage';
import { isConnected } from '@/lib/microsoft-graph';

// GET - Retrieve configuration (public, but sensitive data filtered)
export async function GET(request: NextRequest) {
  try {
    const config = await getConfig();
    const outlookConnected = await isConnected();
    
    // Return config with updated connection status
    // Filter out booked slots for public view
    const publicConfig = {
      businessName: config.businessName,
      logo: config.logo,
      primaryColor: config.primaryColor,
      accentColor: config.accentColor,
      startHour: config.startHour,
      endHour: config.endHour,
      timezone: config.timezone,
      meetingTypes: config.meetingTypes,
      outlookConnected,
    };
    
    return NextResponse.json({
      success: true,
      data: publicConfig,
    });
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

// PUT - Update configuration (requires authentication)
export async function PUT(request: NextRequest) {
  try {
    // Note: Add authentication check in production
    // if (!(await isAuthenticated(request))) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const updates = await request.json();
    
    // Validate updates
    if (updates.startHour !== undefined && (updates.startHour < 0 || updates.startHour > 23)) {
      return NextResponse.json(
        { success: false, error: 'Invalid start hour' },
        { status: 400 }
      );
    }
    
    if (updates.endHour !== undefined && (updates.endHour < 1 || updates.endHour > 24)) {
      return NextResponse.json(
        { success: false, error: 'Invalid end hour' },
        { status: 400 }
      );
    }
    
    if (updates.startHour !== undefined && updates.endHour !== undefined && updates.startHour >= updates.endHour) {
      return NextResponse.json(
        { success: false, error: 'Start hour must be before end hour' },
        { status: 400 }
      );
    }
    
    const newConfig = await updateConfig(updates);
    
    return NextResponse.json({
      success: true,
      data: newConfig,
    });
  } catch (error: any) {
    console.error('Update config error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
