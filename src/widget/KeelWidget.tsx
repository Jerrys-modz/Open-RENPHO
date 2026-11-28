import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { PlatformColor } from 'react-native';
import type { KeelWidgetProps } from './snapshot';

/**
 * Home-screen widget: the latest weight and blood pressure. It runs in its own isolated runtime, so it can only
 * use the props it is given and nothing declared outside this function. The app pushes new numbers with
 * `updateSnapshot` whenever a reading is saved.
 */
function KeelWidget(props: KeelWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const medium = environment.widgetFamily === 'systemMedium';
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

  const weight = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 12 }), secondary]}>Weight</Text>
      <Text modifiers={[font({ size: medium ? 30 : 22, weight: 'bold', design: 'rounded' })]}>
        {props.weight} {props.weightUnit}
      </Text>
      <Text modifiers={[font({ size: 11 }), secondary]}>{props.weightWhen}</Text>
    </VStack>
  );

  const bp = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 12 }), secondary]}>Blood pressure</Text>
      <Text modifiers={[font({ size: medium ? 30 : 22, weight: 'bold', design: 'rounded' })]}>
        {props.bp} {props.bpUnit}
      </Text>
      <Text modifiers={[font({ size: 11 }), props.bpColor ? foregroundStyle(props.bpColor) : secondary]}>
        {props.bpCategory ? `${props.bpCategory} · ${props.bpWhen}` : props.bpWhen}
      </Text>
    </VStack>
  );

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[padding({ all: 12 }), containerBackground(PlatformColor('systemBackground'), 'widget')]}
    >
      {props.person ? <Text modifiers={[font({ size: 11, weight: 'semibold' }), secondary]}>{props.person}</Text> : null}
      {medium ? (
        <HStack spacing={24} alignment="top">
          {weight}
          {bp}
        </HStack>
      ) : (
        <VStack alignment="leading" spacing={8}>
          {weight}
          {bp}
        </VStack>
      )}
    </VStack>
  );
}

export default createWidget('KeelWidget', KeelWidget, {
  person: '',
  weight: '--',
  weightUnit: '',
  weightWhen: '',
  bp: '--',
  bpUnit: '',
  bpCategory: '',
  bpColor: '',
  bpWhen: '',
});
