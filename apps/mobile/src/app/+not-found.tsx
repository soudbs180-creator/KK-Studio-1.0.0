import { Ionicons } from '@expo/vector-icons';
import {
  type RelativePathString,
  type SitemapType,
  Stack,
  useGlobalSearchParams,
  useRouter,
  useSitemap,
} from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBoundaryWrapper } from '../../__create/SharedErrorBoundary';

function NotFoundScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams();
  const expoSitemap = useSitemap();
  const missingPath = params['not-found']?.[0] || '';

  const availableRoutes = useMemo(() => {
    return (
      expoSitemap?.children?.filter(
        (child) =>
          child.href &&
          child.contextKey !== './auth.jsx' &&
          child.contextKey !== './auth.web.jsx' &&
          child.contextKey !== './+not-found.tsx' &&
          child.contextKey !== 'expo-router/build/views/Sitemap.js'
      ) || []
    );
  }, [expoSitemap]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    const hasTabsIndex = expoSitemap?.children?.some(
      (child) =>
        child.contextKey === './(tabs)/_layout.jsx' &&
        child.children.some((child) => child.contextKey === './(tabs)/index.jsx')
    );

    if (hasTabsIndex) {
      router.replace('../(tabs)/index.jsx');
    } else {
      router.replace('../');
    }
  };

  const handleNavigate = (url: string) => {
    try {
      if (url) {
        router.push(url as RelativePathString);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color="#666" />
            </TouchableOpacity>
            <View style={styles.pathContainer}>
              <View style={styles.pathPrefix}>
                <Text style={styles.pathPrefixText}>/</Text>
              </View>
              <View style={styles.pathContent}>
                <Text style={styles.pathText} numberOfLines={1}>
                  {missingPath}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.mainContent}>
            <Text style={styles.title}>Uh-oh! This screen doesn't exist yet.</Text>

            <Text style={styles.subtitle}>
              Looks like "<Text style={styles.boldText}>/{missingPath}</Text>" isn't part of your
              project. You can jump to one of the available screens below.
            </Text>

            <Text style={styles.routesLabel}>Check out all your project's routes here -&gt;</Text>
            <View style={styles.pagesContainer}>
              <View style={styles.pagesListContainer}>
                <Text style={styles.pagesLabel}>MOBILE</Text>
                {(availableRoutes as SitemapType[]).map((route: SitemapType) => {
                  const url =
                    typeof route.href === 'string' ? route.href : route.href?.pathname || '/';

                  if (url === '/(tabs)' && route.children) {
                    return route.children.map((childRoute: SitemapType) => {
                      const childUrl =
                        typeof childRoute.href === 'string'
                          ? childRoute.href
                          : childRoute.href.pathname || '/';
                      const displayPath =
                        childUrl === '/(tabs)'
                          ? 'Homepage'
                          : childUrl.replace(/^\//, '').replace(/^\(tabs\)\//, '');
                      return (
                        <TouchableOpacity
                          key={childRoute.contextKey}
                          onPress={() => handleNavigate(childUrl)}
                          style={styles.pageButton}
                        >
                          <Text style={styles.routeName}>{displayPath}</Text>
                        </TouchableOpacity>
                      );
                    });
                  }

                  const displayPath = url === '/' ? 'Homepage' : url.replace(/^\//, '');

                  return (
                    <TouchableOpacity
                      key={route.contextKey}
                      onPress={() => handleNavigate(url)}
                      style={styles.pageButton}
                    >
                      <Text style={styles.routeName}>{displayPath}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathContainer: {
    flexDirection: 'row',
    height: 32,
    width: 300,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  pathPrefix: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e5e5',
  },
  pathPrefixText: {
    color: '#666',
  },
  pathContent: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  pathText: {
    color: '#666',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '500',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    paddingTop: 16,
    paddingBottom: 48,
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  boldText: {
    fontWeight: 'bold',
  },
  routesLabel: {
    color: '#666',
    marginBottom: 80,
    textAlign: 'center',
  },
  pagesContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pagesLabel: {
    fontSize: 14,
    color: '#ccc',
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  pagesListContainer: {
    width: '100%',
    maxWidth: 600,
    gap: 10,
  },
  pageButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },
});

export default () => {
  return (
    <ErrorBoundaryWrapper>
      <NotFoundScreen />
    </ErrorBoundaryWrapper>
  );
};
