package com.proustclub;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.ConfigurableApplicationContext;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ProustClubApplicationTests {

    @Test
    void contextLoads() {
    }

    @Test
    void routesOneOffCommandsToNonWebProfiles() {
        assertThat(ProustClubApplication.modeFor("import-proust"))
                .isEqualTo(new ProustClubApplication.ApplicationMode(WebApplicationType.NONE, "import"));
        assertThat(ProustClubApplication.modeFor("provision-admin"))
                .isEqualTo(new ProustClubApplication.ApplicationMode(WebApplicationType.NONE, "admin-provision"));
        assertThat(ProustClubApplication.modeFor("reset-admin-mfa"))
                .isEqualTo(new ProustClubApplication.ApplicationMode(WebApplicationType.NONE, "admin-mfa-reset"));
        assertThat(ProustClubApplication.modeFor())
                .isEqualTo(new ProustClubApplication.ApplicationMode(WebApplicationType.SERVLET, null));
    }

    @Test
    void closesTheContextAfterOneOffCommandsButKeepsTheWebServerRunning() {
        var cliContext = mock(ConfigurableApplicationContext.class);
        var webContext = mock(ConfigurableApplicationContext.class);

        ProustClubApplication.closeContextAfterOneOffCommand(
                cliContext, ProustClubApplication.modeFor("provision-admin"));
        ProustClubApplication.closeContextAfterOneOffCommand(
                webContext, ProustClubApplication.modeFor());

        verify(cliContext).close();
        verify(webContext, never()).close();
    }
}
