import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';

export type AnatomicalStretchId =
  | 'standing-quad'
  | 'standing-hamstring'
  | 'wall-calf'
  | 'kneeling-hip-flexor'
  | 'figure-four-glute'
  | 'childs-pose';

export type StretchSide = 'left' | 'right';

export type AnatomicalStretchMotionProps = {
  stretch: AnatomicalStretchId;
  side?: StretchSide;
  playing?: boolean;
  size?: number;
  accessibilityLabel?: string;
};

const FRAME_SOURCES: Record<AnatomicalStretchId, ImageSourcePropType[]> = {
  'standing-quad': [
    require('../assets/frames/standing-quad/01.png'),
    require('../assets/frames/standing-quad/02.png'),
    require('../assets/frames/standing-quad/03.png'),
    require('../assets/frames/standing-quad/04.png'),
  ],
  'standing-hamstring': [
    require('../assets/frames/standing-hamstring/01.png'),
    require('../assets/frames/standing-hamstring/02.png'),
    require('../assets/frames/standing-hamstring/03.png'),
    require('../assets/frames/standing-hamstring/04.png'),
  ],
  'wall-calf': [
    require('../assets/frames/wall-calf/01.png'),
    require('../assets/frames/wall-calf/02.png'),
    require('../assets/frames/wall-calf/03.png'),
    require('../assets/frames/wall-calf/04.png'),
  ],
  'kneeling-hip-flexor': [
    require('../assets/frames/kneeling-hip-flexor/01.png'),
    require('../assets/frames/kneeling-hip-flexor/02.png'),
    require('../assets/frames/kneeling-hip-flexor/03.png'),
    require('../assets/frames/kneeling-hip-flexor/04.png'),
  ],
  'figure-four-glute': [
    require('../assets/frames/figure-four-glute/01.png'),
    require('../assets/frames/figure-four-glute/02.png'),
    require('../assets/frames/figure-four-glute/03.png'),
    require('../assets/frames/figure-four-glute/04.png'),
  ],
  'childs-pose': [
    require('../assets/frames/childs-pose/01.png'),
    require('../assets/frames/childs-pose/02.png'),
    require('../assets/frames/childs-pose/03.png'),
    require('../assets/frames/childs-pose/04.png'),
  ],
};

const DISPLAY_NAMES: Record<AnatomicalStretchId, string> = {
  'standing-quad': 'Standing quad stretch',
  'standing-hamstring': 'Standing hamstring stretch',
  'wall-calf': 'Calf stretch against a wall',
  'kneeling-hip-flexor': 'Kneeling hip flexor stretch',
  'figure-four-glute': 'Figure-four glute stretch',
  'childs-pose': 'Child’s pose',
};

const TARGET_NAMES: Record<AnatomicalStretchId, string> = {
  'standing-quad': 'front of the thigh',
  'standing-hamstring': 'back of the thigh',
  'wall-calf': 'calf and Achilles',
  'kneeling-hip-flexor': 'front of the hip',
  'figure-four-glute': 'glute and outside of the hip',
  'childs-pose': 'lower back and shoulders',
};

const SEQUENCE = [0, 1, 2, 3, 3, 3, 2, 1] as const;
const STEP_DURATION_MS = [700, 700, 700, 650, 650, 1650, 600, 600] as const;

export function AnatomicalStretchMotion({
  stretch,
  side = 'left',
  playing = true,
  size = 360,
  accessibilityLabel,
}: AnatomicalStretchMotionProps) {
  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const isBilateral = stretch !== 'childs-pose';

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    opacity.setValue(1);
    setStep(playing && !reduceMotion ? 0 : 3);
  }, [opacity, playing, reduceMotion, stretch]);

  useEffect(() => {
    if (!playing || reduceMotion) return undefined;
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0.2,
        duration: 100,
        useNativeDriver: true,
      }).start(() => {
        setStep(current => (current + 1) % SEQUENCE.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }).start();
      });
    }, STEP_DURATION_MS[step]);
    return () => clearTimeout(timeout);
  }, [opacity, playing, reduceMotion, step]);

  const source = useMemo(() => FRAME_SOURCES[stretch][SEQUENCE[step]], [step, stretch]);
  const label = accessibilityLabel ??
    `${DISPLAY_NAMES[stretch]}. Animated anatomical demonstration. Target area: ${TARGET_NAMES[stretch]}.`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, {width: size, height: size}]}
    >
      <Animated.Image
        source={source}
        resizeMode="contain"
        style={[
          styles.image,
          {
            opacity,
            transform: [{scaleX: isBilateral && side === 'right' ? -1 : 1}],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default AnatomicalStretchMotion;
