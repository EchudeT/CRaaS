import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Toaster } from '@/components/ui'
import Home from '@/pages/Home'
import TopologyBuild from '@/pages/TopologyBuild'
import Templates from '@/pages/Templates'
import TemplateEditor from '@/pages/TemplateEditor'
import Orchestrate from '@/pages/Orchestrate'
import DeployConsole from '@/pages/DeployConsole'
import Instances from '@/pages/Instances'
import InstanceDetail from '@/pages/InstanceDetail'
import ResourcesOverview from '@/pages/ResourcesOverview'
import Images from '@/pages/Images'
import Compute from '@/pages/Compute'
import StoragePage from '@/pages/StoragePage'
import NetworkPage from '@/pages/NetworkPage'
import Monitor from '@/pages/Monitor'
import Scheduler from '@/pages/Scheduler'
import EntityCatalog from '@/pages/EntityCatalog'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/topology" element={<TopologyBuild />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/entities" element={<EntityCatalog />} />
          <Route path="/templates/:id" element={<TemplateEditor />} />
          <Route path="/orchestrate" element={<Orchestrate />} />
          <Route path="/orchestrate/:templateId" element={<DeployConsole />} />
          <Route path="/instances" element={<Instances />} />
          <Route path="/instances/:id" element={<InstanceDetail />} />
          <Route path="/resources" element={<ResourcesOverview />} />
          <Route path="/resources/images" element={<Images />} />
          <Route path="/resources/compute" element={<Compute />} />
          <Route path="/resources/storage" element={<StoragePage />} />
          <Route path="/resources/network" element={<NetworkPage />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/scheduler" element={<Scheduler />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
