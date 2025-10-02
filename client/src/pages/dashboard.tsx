import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useSheets";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useDashboardData();

  // Show authentication prompt if not logged in
  if (!user) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground mb-4">
              <i className="fas fa-sign-in-alt text-4xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Dashboard Access</h3>
            <p className="text-muted-foreground mb-4">You need to sign in to access dashboard data.</p>
            <Button onClick={() => window.location.href = '/login'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground mb-4">
              <i className="fab fa-google text-4xl text-blue-500"></i>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Google Sheets Connection Required</h3>
            <p className="text-muted-foreground mb-4">
              You need to connect with Google Sheets to view dashboard data.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground mb-4">
              <p>Spreadsheet ID: 1gOjceZ4DxORlbD1rTiGxgxoATvmKLVsIhyeE8UPtdlU</p>
              <p>Make sure you have edit permission for this spreadsheet.</p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={async () => {
                  try {
                    const { googleSheetsClient } = await import('@/services/googleSheets');
                    await googleSheetsClient.signIn();
                    window.location.reload();
                  } catch (error) {
                    console.error('Google authentication failed:', error);
                  }
                }}
                className="mb-2"
              >
                <i className="fab fa-google mr-2"></i>
                Connect with Google
              </Button>
              <br />
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Check Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome, {user.email}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <i className="fas fa-table text-blue-600 dark:text-blue-400"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sheets</p>
                <p className="text-2xl font-bold text-foreground">{dashboardData.totalSheets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <i className="fas fa-arrow-up text-green-600 dark:text-green-400"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Income</p>
                <p className="text-2xl font-bold text-foreground">
                  {dashboardData.stats?.income?.toLocaleString('en-US') || '0'} ₺
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <i className="fas fa-arrow-down text-red-600 dark:text-red-400"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expenses</p>
                <p className="text-2xl font-bold text-foreground">
                  {dashboardData.stats?.expenses?.toLocaleString('en-US') || '0'} ₺
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <i className="fas fa-project-diagram text-purple-600 dark:text-purple-400"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold text-foreground">{dashboardData.stats?.projects || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/sheets/new'}>
                <i className="fas fa-plus mr-2"></i>
                Create New Sheet
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.reload()}>
                <i className="fas fa-sync mr-2"></i>
                Refresh Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
            {dashboardData.recentActivity && dashboardData.recentActivity.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.recentActivity.map((activity: any, index: number) => (
                  <div key={index} className="text-sm text-muted-foreground">
                    {activity.description}
                  </div>
                ))}
              </div>
              ) : (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
