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
      <h2 className="text-2xl font-semibold mb-4">Ayarlar</h2>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="config">Konfigürasyonlar</TabsTrigger>
          <TabsTrigger value="vector">Vector Arama</TabsTrigger>
          <TabsTrigger value="advanced">Gelişmiş</TabsTrigger>
          <TabsTrigger value="user">Kullanıcı</TabsTrigger>
          <TabsTrigger value="yetkileri">Kullanıcı Yetkileri</TabsTrigger>
        </TabsList>
        <TabsContent value="vector">
          <VectorSearchSettings />
        </TabsContent>

        <TabsContent value="general">
          <div>Genel ayarlar henüz eklenmedi.</div>
        </TabsContent>

        <TabsContent value="config">
          <ConfigSettings />
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Diğer Konfigürasyonlar</h3>
            <ConfigManagement />
          </div>
        </TabsContent>

        <TabsContent value="advanced">
          <div>Gelişmiş ayarlar (tuning vb.)</div>
          <div className="mt-4">
            <GraphCustomizationProvider>
              <GraphSettings />
            </GraphCustomizationProvider>
          </div>
        </TabsContent>

        <TabsContent value="user">
          <h3 className="text-lg font-medium mb-2">Kullanıcı Ayarları</h3>
          <ColumnSettings open={false} onClose={() => { }} dialogWidth="100%" embedded={true} />
        </TabsContent>

        <TabsContent value="yetkileri">
          <h3 className="text-lg font-medium mb-2">Kullanıcı Yetkileri</h3>
          <UserPermissions />
        </TabsContent>
      </Tabs>
    </div>
  )
}
