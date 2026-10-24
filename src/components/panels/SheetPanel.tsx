import { ExamTextStyle } from '../exam/ExamTextStyle'
import { PanelSection, Segmented } from '../ui'
import { FontPanel } from './FontPanel'
import { LayoutPanel } from './LayoutPanel'
import { PagePanel } from './PagePanel'

export type SheetView = 'header' | 'paper' | 'type'

export function SheetSwitch({ view, onView }: { view: SheetView; onView: (view: SheetView) => void }) {
  return (
    <div className="side-panel__switch">
      <Segmented<SheetView>
        label="卷面項目"
        value={view}
        options={[
          { value: 'header', label: '頁首' },
          { value: 'paper', label: '紙張' },
          { value: 'type', label: '字級' },
        ]}
        onChange={onView}
      />
    </div>
  )
}

export function SheetPanel({ view }: { view: SheetView }) {
  return (
    <div className="side-panel__scroll">
      {view === 'header' ? <LayoutPanel part="header" /> : null}
      {view === 'paper' ? (
        <>
          <PagePanel />
          <LayoutPanel part="flow" />
        </>
      ) : null}
      {view === 'type' ? (
        <>
          <FontPanel />
          <PanelSection
            title="全卷字級"
            description="大題標題、作答說明、小題題文的預設大小。某一題要不同，點那一題後在右側打開「單獨設定」。"
          >
            <ExamTextStyle role="section_heading" label="大題標題" />
            <ExamTextStyle role="instruction" label="作答說明" />
            <ExamTextStyle role="question_body" label="小題題文" />
          </PanelSection>
        </>
      ) : null}
    </div>
  )
}
