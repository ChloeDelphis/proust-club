package com.proustclub.volume;

import com.proustclub.volume.dto.VolumeResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VolumeServiceTest {

    @Mock
    VolumeRepository repository;

    @InjectMocks
    VolumeService service;

    @Test
    void listMapsOnlyTheOrderedPublicVolumeStructure() {
        when(repository.findAll()).thenReturn(List.of(
                new VolumeData(1, "Du côté de chez Swann", 1, 1, 103),
                new VolumeData(2, "À l'ombre des jeunes filles en fleurs", 2, 104, 183)
        ));

        var volumes = service.list();

        assertThat(volumes).extracting(VolumeResponse::id).containsExactly(1, 2);
        assertThat(volumes.get(1).minPage()).isEqualTo(104);
        assertThat(volumes.get(1).maxPage()).isEqualTo(183);
    }
}
