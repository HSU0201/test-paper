import type Konva from 'konva'
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import {
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Transformer,
} from 'react-konva'
import { KonvaTextBlock } from './KonvaTextBlock'
import { EDITOR_ONLY_NAME, HEADER_REF_PREFIX, HeaderItemsLayer, PageDecorLayer } from './PaperLayoutLayer'
import { ExamFlowLayer } from './ExamFlowLayer'
import { useHtmlImage } from './useHtmlImage'
import { useEditor } from '../editor/EditorContext'
import { EDITOR_GUIDE, EDITOR_SELECTION } from '../editor/theme'
import type { EditorAction } from '../editor/reducer'
import { getBoundingBox, lineSegmentBox, type Box } from '../editor/bounds'
import { snapBoxPosition, type SnapGuides } from '../editor/snap'
import type { CanvasObject, ImageObject, LineObject } from '../types/document'

type PaperStageProps = {
  pageIndex: number
  scale: number
  showGuides: boolean
  onTextDoubleClick: (id: string) => void
}

function CanvasImageShape({
  obj,
  onSelect,
  shapeRef,
  onDragMove,
  onDragEnd,
  onTransformEnd,
}: {
  obj: ImageObject
  onSelect: () => void
  shapeRef: (n: Konva.Image | null) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
}) {
  const img = useHtmlImage(obj.src)
  if (!img) return null
  return (
    <KonvaImage
      ref={shapeRef}
      image={img}
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      shadowForStrokeEnabled={false}
    />
  )
}

function boxesExcluding(
  objects: CanvasObject[],
  excludeId: string,
  getPos: (o: CanvasObject) => Box | null,
): Box[] {
  const out: Box[] = []
  for (const o of objects) {
    if (o.id === excludeId) continue
    const b = getPos(o)
    if (b) out.push(b)
  }
  return out
}

/** 吸附對象：其他物件＋版型的內容區與各欄邊界 */
function snapTargets(objects: CanvasObject[], excludeId: string, layoutBoxes: Box[]): Box[] {
  return [...boxesExcluding(objects, excludeId, (o) => getBoundingBox(o)), ...layoutBoxes]
}

export const PaperStage = forwardRef<Konva.Stage, PaperStageProps>(
  function PaperStage({ pageIndex, scale, showGuides, onTextDoubleClick }, ref) {
    const { state, dispatch, sortedObjects, pageGeometry, flow } = useEditor()
    const geometry = pageGeometry(pageIndex)
    const pageObjects = useMemo(
      () => sortedObjects.filter((o) => (o.page ?? 0) === pageIndex),
      [sortedObjects, pageIndex],
    )
    const pageBlocks = useMemo(() => flow.blocks.filter((b) => b.page === pageIndex), [flow.blocks, pageIndex])
    const flagged = useMemo(() => {
      const s = new Set<string>()
      for (const w of flow.warnings) {
        if (w.type === 'headMoved') s.add(w.sectionId)
        if (w.type === 'oversize') s.add(w.ref.id)
      }
      return s
    }, [flow.warnings])

    const stateRef = useRef(state)
    const objectsRef = useRef<CanvasObject[]>(pageObjects)
    const layoutBoxesRef = useRef<Box[]>([])
    useLayoutEffect(() => {
      stateRef.current = state
      objectsRef.current = pageObjects
      layoutBoxesRef.current = [geometry.content, ...geometry.frames]
    }, [state, pageObjects, geometry])

    const transformerRef = useRef<Konva.Transformer>(null)
    const shapeRefs = useRef<Record<string, Konva.Node>>({})
    const [guides, setGuides] = useState<SnapGuides>({ vertical: [], horizontal: [] })

    const pageW = state.pageWidth
    const pageH = state.pageHeight

    const clearGuides = useCallback(() => {
      setGuides({ vertical: [], horizontal: [] })
    }, [])

    const makeDragHandlers = useCallback(
      (id: string, boxFromNode: (node: Konva.Node) => Box) => {
        return {
          onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
            const node = e.target
            const b = boxFromNode(node)
            const others = snapTargets(objectsRef.current, id, layoutBoxesRef.current)
            const r = snapBoxPosition(b, others, pageW, pageH)
            node.absolutePosition({ x: r.x, y: r.y })
            setGuides(r.guides)
          },
          onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
            const node = e.target
            const b = boxFromNode(node)
            const others = snapTargets(objectsRef.current, id, layoutBoxesRef.current)
            const r = snapBoxPosition(b, others, pageW, pageH)
            clearGuides()
            dispatch({ type: 'MOVE_OBJECT', id, x: r.x, y: r.y })
          },
        }
      },
      [clearGuides, dispatch, pageW, pageH],
    )

    const registerRef = useCallback((id: string) => {
      return (n: Konva.Node | null) => {
        if (!n) delete shapeRefs.current[id]
        else shapeRefs.current[id] = n
      }
    }, [])

    useLayoutEffect(() => {
      const tr = transformerRef.current
      if (!tr) return
      const header = state.selectedBlock?.kind === 'header' ? state.selectedBlock.id : null
      if (header) {
        const hn = shapeRefs.current[`${HEADER_REF_PREFIX}${header}`]
        tr.nodes(hn ? [hn] : [])
        tr.enabledAnchors(geometry.headerVertical ? ['top-center', 'bottom-center'] : ['middle-left', 'middle-right'])
        tr.rotateEnabled(false)
        tr.getLayer()?.batchDraw()
        return
      }
      const sid = state.selectedId
      if (!sid) {
        tr.nodes([])
        tr.getLayer()?.batchDraw()
        return
      }
      const obj = pageObjects.find((o) => o.id === sid)
      if (!obj || obj.type === 'line') {
        tr.nodes([])
        tr.getLayer()?.batchDraw()
        return
      }
      const n = shapeRefs.current[sid]
      if (!n) {
        tr.nodes([])
        tr.getLayer()?.batchDraw()
        return
      }
      tr.nodes([n])
      if (obj.type === 'text') {
        tr.enabledAnchors(['middle-left', 'middle-right'])
      } else {
        tr.enabledAnchors([
          'top-left',
          'top-center',
          'top-right',
          'middle-right',
          'middle-left',
          'bottom-left',
          'bottom-center',
          'bottom-right',
        ])
      }
      tr.rotateEnabled(false)
      tr.getLayer()?.batchDraw()
    }, [state.selectedId, state.selectedBlock, pageObjects, state.layout.header, geometry.headerVertical])

    const handleStageMouseDown = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        dispatch({ type: 'SET_ACTIVE_PAGE', page: pageIndex })
        if (e.target.name() === 'page-bg') {
          const mode = stateRef.current.textPlacementMode
          if (mode) {
            const stage = e.target.getStage()
            const p = stage?.getRelativePointerPosition()
            if (p) dispatch({ type: 'PLACE_TEXT_AT', x: p.x, y: p.y, page: pageIndex })
            return
          }
          dispatch({ type: 'SELECT', id: null })
          dispatch({ type: 'SELECT_BLOCK', ref: null })
        }
      },
      [dispatch, pageIndex],
    )

    const handleRectImageTransformEnd = useCallback(
      (id: string, node: Konva.Rect | Konva.Image) => {
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        dispatch({
          type: 'RESIZE_OR_TRANSFORM',
          id,
          patch: {
            x: node.x(),
            y: node.y(),
            width: Math.max(8, node.width() * scaleX),
            height: Math.max(8, node.height() * scaleY),
          },
        })
      },
      [dispatch],
    )

    return (
      <div
        className={`paper-stage-wrap${state.textPlacementMode ? ' paper-stage-wrap--place-text' : ''}`}
        style={{
          width: pageW * scale,
          height: pageH * scale,
          position: 'relative',
        }}
      >
        <div
          className="paper-stage-scale"
          style={{
            width: pageW,
            height: pageH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Stage
            ref={ref}
            width={pageW}
            height={pageH}
            onMouseDown={handleStageMouseDown}
          >
            <Layer>
              <Rect
                name="page-bg"
                x={0}
                y={0}
                width={pageW}
                height={pageH}
                fill="#ffffff"
                shadowColor="rgba(15,23,42,0.12)"
                shadowBlur={24}
                shadowOffset={{ x: 0, y: 8 }}
                listening
              />
              <PageDecorLayer geometry={geometry} showGuides={showGuides} />
              {geometry.header ? (
                <HeaderItemsLayer
                  header={state.layout.header}
                  box={geometry.header}
                  vertical={geometry.headerVertical}
                  pageW={pageW}
                  pageH={pageH}
                  selectedId={state.selectedBlock?.kind === 'header' ? state.selectedBlock.id : null}
                  interactive={!state.textPlacementMode}
                  dispatch={dispatch}
                  registerRef={registerRef}
                  setGuides={setGuides}
                  clearGuides={clearGuides}
                  fontFamily={state.paperFontFamily}
                />
              ) : null}
              <ExamFlowLayer
                blocks={pageBlocks}
                assets={state.exam.assets}
                selected={state.selectedBlock}
                flagged={flagged}
                interactive={!state.textPlacementMode}
                dispatch={dispatch}
                fontFamily={state.paperFontFamily}
              />
              {pageObjects.map((obj) => {
                if (obj.type === 'text') {
                  const isSelected = state.selectedId === obj.id
                  const { onDragMove, onDragEnd } = makeDragHandlers(obj.id, (node) => {
                    const g = node as Konva.Group
                    const bg = g.findOne('Rect') as Konva.Rect | null
                    if (!bg) {
                      return { x: g.x(), y: g.y(), w: obj.width, h: Math.max(28, obj.fontSize * 2) }
                    }
                    return { x: g.x(), y: g.y(), w: bg.width(), h: bg.height() }
                  })
                  return (
                    <KonvaTextBlock
                      key={obj.id}
                      obj={obj}
                      isSelected={isSelected}
                      placementActive={state.textPlacementMode}
                      dispatch={dispatch}
                      onTextDoubleClick={onTextDoubleClick}
                      registerRef={registerRef}
                      onDragMove={onDragMove}
                      onDragEnd={onDragEnd}
                    />
                  )
                }
                if (obj.type === 'rect') {
                  const isSelected = state.selectedId === obj.id
                  const { onDragMove, onDragEnd } = makeDragHandlers(obj.id, (node) => ({
                    x: node.x(),
                    y: node.y(),
                    w: obj.width,
                    h: obj.height,
                  }))
                  return (
                    <Rect
                      key={obj.id}
                      ref={registerRef(obj.id) as (n: Konva.Rect | null) => void}
                      id={obj.id}
                      x={obj.x}
                      y={obj.y}
                      width={obj.width}
                      height={obj.height}
                      fill={obj.fill === 'transparent' ? undefined : obj.fill}
                      stroke={isSelected ? EDITOR_SELECTION : obj.stroke}
                      strokeWidth={isSelected ? 2 : obj.strokeWidth}
                      cornerRadius={obj.cornerRadius}
                      draggable
                      onClick={() => dispatch({ type: 'SELECT', id: obj.id })}
                      onTap={() => dispatch({ type: 'SELECT', id: obj.id })}
                      onDragMove={onDragMove}
                      onDragEnd={onDragEnd}
                      onTransformEnd={(e) =>
                        handleRectImageTransformEnd(obj.id, e.target as Konva.Rect)
                      }
                    />
                  )
                }
                if (obj.type === 'image') {
                  const { onDragMove, onDragEnd } = makeDragHandlers(obj.id, (node) => ({
                    x: node.x(),
                    y: node.y(),
                    w: obj.width,
                    h: obj.height,
                  }))
                  return (
                    <CanvasImageShape
                      key={obj.id}
                      obj={obj}
                      onSelect={() => dispatch({ type: 'SELECT', id: obj.id })}
                      shapeRef={registerRef(obj.id) as (n: Konva.Image | null) => void}
                      onDragMove={onDragMove}
                      onDragEnd={onDragEnd}
                      onTransformEnd={(e) =>
                        handleRectImageTransformEnd(obj.id, e.target as Konva.Image)
                      }
                    />
                  )
                }
                if (obj.type === 'line') {
                  const isSelected = state.selectedId === obj.id
                  return (
                    <LineShape
                      key={obj.id}
                      obj={obj}
                      isSelected={isSelected}
                      pageW={pageW}
                      pageH={pageH}
                      registerRef={registerRef}
                      dispatch={dispatch}
                      objectsRef={objectsRef}
                      setGuides={setGuides}
                      clearGuides={clearGuides}
                    />
                  )
                }
                return null
              })}
              <Transformer
                ref={transformerRef}
                name={EDITOR_ONLY_NAME}
                borderStroke={EDITOR_SELECTION}
                anchorStroke={EDITOR_SELECTION}
              />
            </Layer>
            <Layer listening={false} name={EDITOR_ONLY_NAME}>
              {guides.vertical.map((gx, i) => (
                <Line
                  key={`vg-${i}-${gx}`}
                  points={[gx, 0, gx, pageH]}
                  stroke={EDITOR_GUIDE}
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              ))}
              {guides.horizontal.map((gy, i) => (
                <Line
                  key={`hg-${i}-${gy}`}
                  points={[0, gy, pageW, gy]}
                  stroke={EDITOR_GUIDE}
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    )
  },
)

function LineShape({
  obj,
  isSelected,
  pageW,
  pageH,
  registerRef,
  dispatch,
  objectsRef,
  setGuides,
  clearGuides,
}: {
  obj: LineObject
  isSelected: boolean
  pageW: number
  pageH: number
  registerRef: (id: string) => (n: Konva.Node | null) => void
  dispatch: (a: EditorAction) => void
  objectsRef: MutableRefObject<CanvasObject[]>
  setGuides: (g: SnapGuides) => void
  clearGuides: () => void
}) {
  return (
    <Line
      ref={registerRef(obj.id) as (n: Konva.Line | null) => void}
      id={obj.id}
      x={0}
      y={0}
      points={[obj.x1, obj.y1, obj.x2, obj.y2]}
      stroke={isSelected ? EDITOR_SELECTION : obj.stroke}
      strokeWidth={isSelected ? obj.strokeWidth + 1 : obj.strokeWidth}
      hitStrokeWidth={Math.max(12, obj.strokeWidth)}
      draggable
      onClick={() => dispatch({ type: 'SELECT', id: obj.id })}
      onTap={() => dispatch({ type: 'SELECT', id: obj.id })}
      onDragMove={(e) => {
        const n = e.target as Konva.Line
        const dx = n.x()
        const dy = n.y()
        const p = n.points()
        const wx1 = p[0] + dx
        const wy1 = p[1] + dy
        const wx2 = p[2] + dx
        const wy2 = p[3] + dy
        const b = lineSegmentBox(wx1, wy1, wx2, wy2)
        const others = boxesExcluding(objectsRef.current, obj.id, (o) => getBoundingBox(o))
        const r = snapBoxPosition(b, others, pageW, pageH)
        const sdx = r.x - b.x
        const sdy = r.y - b.y
        n.absolutePosition({ x: dx + sdx, y: dy + sdy })
        setGuides(r.guides)
      }}
      onDragEnd={(e) => {
        const n = e.target as Konva.Line
        const dx = n.x()
        const dy = n.y()
        const p = n.points()
        n.position({ x: 0, y: 0 })
        const wx1 = p[0] + dx
        const wy1 = p[1] + dy
        const wx2 = p[2] + dx
        const wy2 = p[3] + dy
        const b = lineSegmentBox(wx1, wy1, wx2, wy2)
        const others = boxesExcluding(objectsRef.current, obj.id, (o) => getBoundingBox(o))
        const r = snapBoxPosition(b, others, pageW, pageH)
        const sdx = r.x - b.x
        const sdy = r.y - b.y
        clearGuides()
        dispatch({
          type: 'MOVE_LINE',
          id: obj.id,
          x1: wx1 + sdx,
          y1: wy1 + sdy,
          x2: wx2 + sdx,
          y2: wy2 + sdy,
        })
      }}
    />
  )
}
