import type Konva from 'konva'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type { EditorAction } from '../editor/reducer'
import { TEXT_BOX_PADDING, type TextObject } from '../types/document'

function syncBgToText(bg: Konva.Rect, inner: Konva.Text, outerWidth: number) {
  const th = inner.height()
  bg.width(outerWidth)
  bg.height(Math.max(TEXT_BOX_PADDING * 2 + inner.fontSize() * 1.25, th + TEXT_BOX_PADDING * 2))
}

type KonvaTextBlockProps = {
  obj: TextObject
  isSelected: boolean
  /** 放置新文字模式：關閉拖曳並在 mousedown 立即選取，避免拖曳吃掉 click */
  placementActive: boolean
  dispatch: (a: EditorAction) => void
  onTextDoubleClick: (id: string) => void
  registerRef: (id: string) => (n: Konva.Node | null) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
}

export function KonvaTextBlock({
  obj,
  isSelected,
  placementActive,
  dispatch,
  onTextDoubleClick,
  registerRef,
  onDragMove,
  onDragEnd,
}: KonvaTextBlockProps) {
  const innerRef = useRef<Konva.Text>(null)
  const bgRef = useRef<Konva.Rect>(null)

  const innerW = Math.max(40, obj.width - TEXT_BOX_PADDING * 2)

  useLayoutEffect(() => {
    const inner = innerRef.current
    const bg = bgRef.current
    if (!inner || !bg) return
    syncBgToText(bg, inner, obj.width)
  }, [obj.text, obj.width, obj.fontSize, obj.fontFamily, obj.fontStyle, obj.align, innerW])

  const onTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const g = e.target as Konva.Group
    const inner = innerRef.current
    const bg = bgRef.current
    if (!inner || !bg) return
    const sx = g.scaleX()
    if (Math.abs(sx - 1) < 1e-9) return
    const nextInnerW = Math.max(40, inner.width() * sx)
    inner.width(nextInnerW)
    g.scaleX(1)
    g.scaleY(1)
    syncBgToText(bg, inner, nextInnerW + TEXT_BOX_PADDING * 2)
  }, [])

  const onTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const g = e.target as Konva.Group
      const inner = innerRef.current
      const bg = bgRef.current
      if (!inner || !bg) return
      const sx = g.scaleX()
      g.scaleX(1)
      g.scaleY(1)
      const outerW = Math.max(48, inner.width() * sx + TEXT_BOX_PADDING * 2)
      inner.width(outerW - TEXT_BOX_PADDING * 2)
      syncBgToText(bg, inner, outerW)
      dispatch({
        type: 'RESIZE_OR_TRANSFORM',
        id: obj.id,
        patch: {
          x: g.x(),
          y: g.y(),
          width: outerW,
        },
      })
    },
    [dispatch, obj.id],
  )

  const outline = isSelected ? obj.boxStroke : undefined

  const onPointerSelect = useCallback(() => {
    dispatch({ type: 'SELECT', id: obj.id })
  }, [dispatch, obj.id])

  const onGroupMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (placementActive) {
        e.cancelBubble = true
        onPointerSelect()
      }
    },
    [placementActive, onPointerSelect],
  )

  return (
    <Group
      id={obj.id}
      ref={registerRef(obj.id)}
      x={obj.x}
      y={obj.y}
      draggable={!placementActive}
      onMouseDown={onGroupMouseDown}
      onClick={onPointerSelect}
      onTap={onPointerSelect}
      onDblClick={() => onTextDoubleClick(obj.id)}
      onDblTap={() => onTextDoubleClick(obj.id)}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransform={onTransform}
      onTransformEnd={onTransformEnd}
    >
      <Rect
        ref={bgRef}
        x={0}
        y={0}
        width={obj.width}
        height={Math.max(obj.fontSize * 2.5, obj.fontSize * 1.25 + TEXT_BOX_PADDING * 2)}
        fill="transparent"
        stroke={outline}
        strokeWidth={isSelected ? 2 : 0}
        cornerRadius={4}
        listening
      />
      <Text
        ref={innerRef}
        x={TEXT_BOX_PADDING}
        y={TEXT_BOX_PADDING}
        width={innerW}
        text={obj.text}
        fontSize={obj.fontSize}
        fontFamily={obj.fontFamily}
        fill={obj.fill}
        fontStyle={obj.fontStyle}
        align={obj.align}
        wrap="word"
        lineHeight={1.25}
        listening={false}
      />
    </Group>
  )
}
