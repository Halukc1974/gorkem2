import React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import ColumnSettings from '../components/settings/ColumnSettings'
import ConfigSettings from '../components/settings/ConfigSettings'
import ConfigManagement from '../components/ConfigManagement'
import GraphSettings from '../components/settings/GraphSettings'
import { GraphCustomizationProvider } from '../components/graph-engine/context/GraphCustomizationContext'
import VectorSearchSettings from '../components/settings/VectorSearchSettings'
import UserPermissions from '../components/settings/UserPermissions'

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Settings</h2>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="config">Configurations</TabsTrigger>
          <TabsTrigger value="vector">Vector Search</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="user">Info Center Columns</TabsTrigger>
          <TabsTrigger value="yetkileri">User Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="vector">
          <VectorSearchSettings />
        </TabsContent>

        <TabsContent value="general">
          <div>General settings not yet added.</div>
        </TabsContent>

        <TabsContent value="config">
          <ConfigSettings />
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Other Configurations</h3>
            <ConfigManagement />
          </div>
        </TabsContent>

        <TabsContent value="advanced">
          <div>Advanced settings (tuning, etc.)</div>
          <div className="mt-4">
            <GraphCustomizationProvider>
              <GraphSettings />
            </GraphCustomizationProvider>
          </div>
        </TabsContent>

        <TabsContent value="user">
          <h3 className="text-lg font-medium mb-2">User Settings</h3>
          <ColumnSettings open={false} onClose={() => { }} dialogWidth="100%" embedded={true} />
        </TabsContent>

        <TabsContent value="yetkileri">
          <h3 className="text-lg font-medium mb-2">User Permissions</h3>
          <UserPermissions />
        </TabsContent>
      </Tabs>
    </div>
  )
}
