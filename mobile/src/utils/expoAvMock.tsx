import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
};

export namespace Audio {
  export type Sound = any;
  export type Recording = any;
  export const RecordingOptionsPresets = { HIGH_QUALITY: {} };
  export const setAudioModeAsync = async (options?: any) => {};
  export const requestPermissionsAsync = async () => ({ status: 'granted' });
  export const Sound = {
    createAsync: async (source?: any, initialStatus?: any, onPlaybackStatusUpdate?: any) => ({
      sound: {
        getStatusAsync: async () => ({ isLoaded: false }),
        unloadAsync: async () => {},
        pauseAsync: async () => {},
        setPositionAsync: async () => {},
        playAsync: async () => {},
      },
    }),
  };
  export const Recording = {
    createAsync: async (options?: any) => ({
      recording: {
        startAsync: async () => {},
        pauseAsync: async () => {},
        stopAndUnloadAsync: async () => {},
        getURI: () => null,
      },
    }),
  };
}

export function Video(props: any) {
  return (
    <View style={[props.style, styles.videoPlaceholder]}>
      <Text style={styles.text}>🎥 Video Playback (Mocked on iOS)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  videoPlaceholder: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    aspectRatio: 16 / 9,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
